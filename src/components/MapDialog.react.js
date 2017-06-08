/**
 * Created by nakayama on 24/08/15.
 */
const React     = require('react');
const ReactDOM  = require('react-dom');
const SearchBox = require("react-google-maps").SearchBox;
const MomentTz  = require('moment-timezone');

const Button             = require('../Button.react');
const Dialog             = require('../Dialog.react');
const Checkbox           = require('../Checkbox.react');
const SelectBootstrap    = require('../SelectBootstrap.react');
const ConfirmationDialog = require('../ConfirmationDialog.react');

const TimeInput    = require('./TimeInput.react');
const ObjectHelper = require('../../utils/ObjectHelper.js');
const AppHelper    = require('../../utils/AppHelper.js');
const GmapParser = require('../../utils/GmapParser');
const MapMixin    = require('./MapMixin.js');
const DialogMixin = require('./DialogMixin.js');

const PERIOD_OPTIONS = {
  'Only this day': null,
  'Everyday':      'daily',
  'Weekly':        'weekly',
  'Monthly':       'monthly',
  'Select others': 'other'
};

const FREQUENCY_RANGES = {
  min: 1,
  max: 20
};

const FREQUENCY_MAP = {
  weekly: 'week(s)',
  monthly: 'months(s)',
  other: 'days(s)'
};

const LOCATION_TYPES = {
  'Home':        'home',
  'Coffee Shop': 'coffee_shop',
  'Park':        'park',
  'Bookstore':   'bookstore',
  'Library':     'library',
  'Other':       'other'
};

function roundTo5(num) {
  return parseFloat(num).toFixed(5)
}

function isObjEqual(obj1, obj2) {
  return isNumEqual(obj1.latitude, obj2.latitude) && isNumEqual(obj1.longitude, obj2.longitude)
}

function isNumEqual(data1, data2) {
  return roundTo5(data1) === roundTo5(data2)
}

const MapDialog = React.createClass({
  mixins: [MapMixin, DialogMixin],

  getInitialState: function() {
    return {
      bounds: null,
      markers: [],
      selectValue: "",
      radius: null,
      showSlider: false,
      showFrequencySelect: false,
      availability: {
        location: this._loadInitialLocation()
      },
      period: null,
      frequency: 1,
      isCreating: true
    };
  },

  componentDidUpdate: function() {
    this.refs.startTimeInput.updateValue(this.state.availability.start);
    this.refs.endTimeInput.updateValue(this.state.availability.end);
  },

  render: function() {
    var mapAndControl = this._renderMapAndControl();
    var bodyMode  = this._renderBodyMode();
    var width     = '710';
    var className = 'with-location';

    if (!this._shouldShowMap()) {
      width = '255';
      className = 'without-location';
    }

    return this.renderDialog(
      'map-dialog',
      className,
      'dialog',
      width,
      [mapAndControl, bodyMode],
      this._renderLessonTypeConfirmation()
    );
  },

  _renderLessonTypeConfirmation: function() {
    return (
      <ConfirmationDialog ref='lessonTypeConfirmation'
                          onLeftBtnClicked={this._onOnlineLessonSelected}
                          onRightBtnClicked={this._onBothLessonSelected}
                          rightTitle='no'
                          leftTitle='yes'
                          message='Is this availability only for online lesson?'/>
    );
  },

  _onOnlineLessonSelected: function() {
    this._showDialogWithLessonMode('online');
  },

  _onBothLessonSelected: function() {
    this._showDialogWithLessonMode('both');
  },

  _showDialogWithLessonMode: function(mode) {
    var availability  = this.state.availability;
    availability.mode = mode;

    this.setState({availability: availability, showFrequencySelect: false}, function() {
      this.showDialog();
      this._loadDefaultLocation();
    });
  },

  _shouldShowMap: function() {
    return this.state.availability.mode === 'both';
  },

  _loadDefaultLocation: function() {
    if (this._shouldShowMap()) {
      // Set default searchBox location by Profile location
      this._setMapToLocaton(this.state.availability.location)
    }
  },

  createAvailability: function(start, end) {
    var availability = this._defaultAvailabilityWithLocation();
    availability.start = start;
    availability.end   = end;
    var locationString = AppHelper.locationString(availability.location)

    this.setState({availability: availability, isCreating: true, period: null}, function() {
      this.refs.lessonTypeConfirmation.show();
      this._setSelectValue('periodSelect', PERIOD_OPTIONS['Only this day']);
      this._setSelectValue('locationTypeSelect', LOCATION_TYPES.Home);
      this._setSelectValue('savedLocationSelect', locationString);
    });
  },

  updateAvailability: function(availability) {
    var markers = [];
    var location = availability.location;
    var locationString = AppHelper.locationString(location)

    if (location) {
      markers.push({
        position: {
          lat: location.latitude,
          lng: location.longitude
        }
      });
    }

    this.setState({markers: markers, availability: availability, isCreating: false}, function() {
      this.showDialog();
      this._setSelectValue('locationTypeSelect', location.place);
      this._setSelectValue('savedLocationSelect', locationString);
    });

    this._setMapToLocaton(location)
  },


  _setSelectValue: function(ref, val) {
    if (this.refs[ref]) {
      this.refs[ref].setValue(val);
    }
  },

  _defaultAvailabilityWithLocation: function() {
    var location = {location: this._loadInitialLocation()};
    return $.extend({}, this._defaultAvailabilityWithoutLocation(), location);
  },

  _loadInitialLocation: function() {
    return this.props.preferenceLocation || this._defaultLocation();
  },

  _defaultLocation: function() {
    return {
      latitude: 47.6205588,
      longitude: -122.3212725,
      radius: null,
      place: 'home'
    };
  },

  _defaultAvailabilityWithoutLocation: function() {
    return {
      start: null,
      end: null,
      mode: 'both'
    };
  },

  _correctWithTimezone: function(time) {
    var momentTime = moment(time);
    var minsOffset = momentTime.utcOffset() - MomentTz().utcOffset();
    momentTime.add(minsOffset, 'minutes');
    return momentTime.utc().format();
  },

  _onSaveChanged: function() {
    this.refs.dialog.hideDialog();

    var availability   = this.state.availability;
    availability.start = this._correctWithTimezone(availability.start);
    availability.end   = this._correctWithTimezone(availability.end);

    if (this._shouldShowMap()) {
      var radius = this._radiusForSlider();
      if (radius && radius !== 0) {
        availability.location.radius = radius;
      } else {
        availability.location.radius = null;
      }
      delete availability.location.id;
      ObjectHelper.renameKey(availability, 'location', 'location_attributes');
    } else {
      delete availability.location;
    }

    if (this.state.isCreating) {
      ObjectHelper.renameKey(availability, 'start', 'starts_at');
      ObjectHelper.renameKey(availability, 'end', 'ends_at');

      var createParams = {availability: availability};
      createParams.period    = this.state.period;
      createParams.frequency = this.state.frequency;

      this.props.onCreateAvailabilitySaved(createParams);
    } else {
      var updateParams = $.extend({}, availability);
      var id        = updateParams.id;
      var recurring = updateParams.recurring;

      delete updateParams['id'];
      delete updateParams['allDay'];
      delete updateParams['mode'];
      delete updateParams['recurring'];

      ObjectHelper.renameKey(updateParams, 'start', 'starts_at');
      ObjectHelper.renameKey(updateParams, 'end', 'ends_at');

      this.props.onUpdateAvailabilitySaved(id, recurring, {availability: updateParams});
    }
  },

  _renderSlider: function() {
    if (this.state.showSlider) {
      return (
        <div>
          <p className='slider-message'>indicate range of location flexibility</p>
          <input id="mySlider"
                 value={this._radiusForSlider()}
                 type="range"
                 onChange={this._handleCircleRadiusChange}
                 min={0}
                 max={1000}
                 step={10} />
        </div>
      );
    }
  },

  _radiusForSlider: function() {
    if (this.state.showSlider) {
      return this._radiusFromState();
    }
  },

  _renderMapAndControl: function() {
    if (this._shouldShowMap()) {
      var searchBox = (
        <SearchBox bounds={this.state.bounds}
                   controlPosition={google.maps.ControlPosition.TOP_LEFT}
                   onPlacesChanged={this._handlePlacesChanged}
                   ref="searchBox"
                   placeholder='your location' />
      );

      return this.renderGoogleMap(
        searchBox,
        this._mapCenterFromState(),
        this._radiusFromState(),
        this.state.markers,
        this._handleBoundsChanged
      );
    }
  },

  _mapCenterFromState: function() {
    return this.mapLocationAttrFrom(this._locationFromState());
  },

  _radiusFromState: function() {
    return this._locationFromState().radius || 0;
  },

  _locationFromState: function() {
    return this.state.availability.location || this._defaultLocation();
  },

  _renderBodyMode: function() {
    var className = 'col-md-12';
    if (this._shouldShowMap()) {
      className = 'col-md-4';
    }
    return (
      <div className={'body-mode ' + className}>
        {this._renderSavedLocation()}
        {this._renderLocationControls()}
        {this._renderTimeInputs()}
        {this._renderFrequencyControls()}
        {this._renderSaveBtn()}
      </div>
    );
  },

  _renderSaveBtn: function() {
    return (
      <div className='actions'>
        <Button onClick={this._onSaveChanged}
                title={this._saveTitle()}
                classType="transparent"/>
      </div>
    );
  },

  _saveTitle: function() {
    return this.state.isCreating ? 'save' : 'save changes';
  },

  _renderSavedLocation: function() {
    if (this._shouldShowMap() && this.props.availabilityLocations.length > 0) {
      return (
        <div className='body-mode-controls location-controls'>
          <p className='title'>MY LOCATIONS</p>
          {this._renderSavedLocationSelect()}
        </div>
      );
    }
  },

  _renderLocationControls: function() {
    if (this._shouldShowMap()) {
      return (
        <div className='body-mode-controls location-controls'>
          <p className='title'>LOCATION TYPE</p>
          {this._renderLocationTypesSelect()}
          <Checkbox name="location" label="flexible location"
                    onClick={this._hideShowSlider}
                    style={{'marginLeft': "22px", 'marginTop': "10px"}} />
          {this._renderSlider()}
        </div>
      );
    }
  },

  _renderTimeInputs: function() {
    return (
      <div className='body-mode-controls time time-inputs'>
        <p className='title'>TIME</p>
        <TimeInput ref='startTimeInput' onTimeInputChanged={this._onStartTimeChanged}/>
        {' - '}
        <TimeInput ref='endTimeInput' onTimeInputChanged={this._onEndTimeChanged}/>
        {this.renderTimezoneAbbr()}
      </div>
    );
  },

  _onStartTimeChanged: function(hours, minutes) {
    this._updateTimeChangeFor('start', hours, minutes);
  },

  _onEndTimeChanged: function(hours, minutes) {
    this._updateTimeChangeFor('end', hours, minutes);
  },

  _updateTimeChangeFor: function(attr, hours, minutes) {
    var newValue = moment(this.state.availability[attr]);
    newValue.hours(hours);
    newValue.minutes(minutes);
    var newState = this.state.availability;
    newState[attr] = newValue;
    this.setState({availability: newState});
  },

  _renderFrequencyControls: function() {
    if (this.state.isCreating) {
      return (
        <div className='body-mode-controls frequency-controls'>
          <p className='title'>FREQUENCY</p>
          {this._renderPeriodSelect()}
          {this._renderFrequencySelect()}
        </div>
      );
    }
  },

  _frequencyUnit: function() {
    if (this.refs.periodSelect) {
      return FREQUENCY_MAP[this.refs.periodSelect.value()];
    }
  },

  _renderFrequencySelect: function() {
    if (this.state.showFrequencySelect) {
      var options = [];
      for (var i = FREQUENCY_RANGES.min; i <= FREQUENCY_RANGES.max; i++) {
        options.push(
          <option value={i} key={i}>{i}</option>
        );
      }
      return (
        <div className='frequency-select-wrapper'>
          <span>every</span>
          <SelectBootstrap ref='frequencySelect' onChange={this._onFrequencySelectChanged}>
            {options}
          </SelectBootstrap>
          <span>{this._frequencyUnit()}</span>
        </div>
      );
    }
  },

  _onPeriodSelectChanged: function() {
    var showFrequencySelect = this._frequencyUnit() !== undefined;
    this.setState({showFrequencySelect: showFrequencySelect});
    this._updatePeriodAndFrequency();
  },

  _onFrequencySelectChanged: function() {
    this._updatePeriodAndFrequency();
  },

  _updatePeriodAndFrequency: function() {
    var period = this.refs.periodSelect.value();
    if (period === 'other') {
      period = 'daily';
    }

    var frequency = 1;
    if (this.state.showFrequencySelect) {
      frequency = this.refs.frequencySelect.value();
    }

    this.setState({period: period, frequency: frequency});
  },

  _renderSavedLocationSelect: function() {
    return (
      <SelectBootstrap ref='savedLocationSelect' onChange={this._onLocationSelectChanged}>
        {this.optionsFromObj(this.props.availabilityLocations)}
      </SelectBootstrap>
    );
  },

  _dropDown: function(dataList, ref, changeHandler) {
    return (
      <SelectBootstrap ref={ref} onChange={changeHandler}>
        {this.optionsFrom(dataList)}
      </SelectBootstrap>
    );
  },

  _renderLocationTypesSelect: function() {
    return this._dropDown(LOCATION_TYPES, 'locationTypeSelect', this._onLocationTypeSelectChanged);
  },

  _renderPeriodSelect: function() {
    if (this.state.isCreating) {
      return this._dropDown(PERIOD_OPTIONS, 'periodSelect', this._onPeriodSelectChanged);
    }
  },

  _onLocationSelectChanged: function() {
    var loc_id = parseInt(this.refs.savedLocationSelect.value());
    var selected_location = AppHelper.findInObjList(this.props.availabilityLocations, loc_id, "id");
    var availability = this.state.availability;
    this._setMapToLocaton(selected_location[0]);
    availability.location = selected_location[0];
    this.setState({availability: availability});
  },

  _onLocationTypeSelectChanged: function() {
    var availability = this.state.availability;
    var location = availability.location || {};

    location.place = this.refs.locationTypeSelect.value();
    availability.location = location;

    this.setState({availability: availability});
  },

  _handleBoundsChanged: function() {
    var mapCenterAttrs = this._centerAttrFromMap(this.refs.map.getCenter())
    var availability = this.state.availability;
    availability.location = $.extend(availability.location, mapCenterAttrs);
    this.setState({
      bounds: this.refs.map.getBounds(),
      availability: availability
    });
  },

  _handlePlacesChanged: function() {
    const places = this.refs.searchBox.getPlaces();
    const circles = [];

    // Add a marker for each place returned from search bar
    places.forEach(function (place) {
      circles.push({
        position: place.geometry.location,
        name: place.name
      });
    });

    // Set markers; set map center to first search result
    var mapCenter      = circles.length > 0 ? circles[0].position : null;
    var availability   = this.state.availability;
    var mapCenterAttrs = this._centerAttrFromMap(mapCenter);
    var gmapPlaces = places[0].address_components ? GmapParser.parse(places[0]) : null;

    var location = gmapPlaces || this._getLocationFromProps(mapCenterAttrs)[0];

    if(!location) {
      location = this.props.preferenceLocation
    }

    location = $.extend(location, mapCenterAttrs)

    availability.location = location;

    this.setState({
      availability: availability,
      markers: circles
    });
    return;
  },

  _centerAttrFromMap: function(mapCenter) {
    var result = {};
    if (mapCenter) {
      result = {latitude: mapCenter.lat(), longitude: mapCenter.lng()};
    }
    return result;
  },

  _handleSelectValueChange: function(e, selectedIndex, menuItem) {
    this.setState({
      selectValue: menuItem['payload']
    });
  },

  _handleCircleRadiusChange: function(e, value) {
    var radius       =  parseInt(e.target.value);
    var availability = this.state.availability;
    availability.location.radius = radius;
    this.setState({availability: availability});
  },

  _hideShowSlider(e) {
    this.setState({showSlider: e.target.checked});
  },

  _closeDialog: function() {
    this.refs.dialog.hideDialog();
  },

  _setMapToLocaton: function(location) {
    var locationString = AppHelper.locationString(location)
    var input = $('#map-dialog .gm-style input').get(0);
    input.value = locationString
    google.maps.event.trigger(input, 'focus');
    google.maps.event.trigger(input, 'keydown', {keyCode: 13});
  },

  _getLocationFromProps: function(mapAttrs) {
    return $.grep(this.props.availabilityLocations, function(item) {
      return isObjEqual(item, mapAttrs)
    });
  }
});

module.exports = MapDialog;
