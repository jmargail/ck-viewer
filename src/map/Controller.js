/**
 * The map controller allow to interact with the map. You can use the Ck.map.Model binding to control the map from a view
 * or you can use directly the map controller functions from another controller or a Ck.Action.
 * 
 * ### ckmap is the controller
 *
 * The events like ckmapReady, the Ck.Controller#getMap (and by inheritance getMap() of all the ck controllers) return a Ck.map.Controller.
 *
 * Example in Ck.map.action.ZoomIn :
 *
 *		var map = Ck.getMap();
 *		map.setZoom( map.getZoom() + 1 );
 *
 * Example in Ck.legend.Controller : 
 *
 *     var layers = this.getMap().getLayers()
 *
 * ### Events relay
 * 
 * The map controller relay also ol.Map events like addLayer.
 *
 */
Ext.define('Ck.map.Controller', {
	extend: 'Ck.Controller',
	alias: 'controller.ckmap',
	
	requires: [
		'Ck.format.OWSContext'
	],
	
	/**
	 * @event ready
	 * Fires when the map is ready (rendered)
	 * @param {Ck.map.Controller} this
	 */
	
	/**
	 * @event ckmapReady
	 * Global event. Fires when the map is ready (rendered)
	 *
	 *		Ext.on('ckmapReady', function(map) {
	 *			this._map = map;
	 *			// Do it here ...
	 *		}, this);
	 * 
	 * @param {Ck.map.Controller} this
	 */
	
	/**
	 * @event loaded
	 * Fires when the map is ready (rendered) and all the layers of the current context are loaded
	 * @param {Ck.map.Controller} this
	 */
	 
	/**
	 * @event layersloaded
	 * Fires when all layers are loaded
	 */
	 
	/**
	 * @event layersloading
	 * Fires when layers begin to load
	 */
	 
	/**
	 * @event ckmapLoaded
	 * Global event. Fires when the map is ready (rendered) and all the layers of the current context are loaded.
	 *
	 *		Ext.on('ckmapLoaded', function(map) {
	 *			this._map = map;
	 *			// Do it here ...
	 *		}, this);
	 *
	 * @param {Ck.map.Controller} this
	 */
	
	/**
	 * @event addlayer
	 * Fires when layer is added to the map
	 * @param {ol.layer.*} layer
	 */
	 
	/**
	 * @event removelayer
	 * Fires when layer is removed from the map
	 * @param {ol.layer.*} layer
	 */
	
	/**
	 * @propety {Ck.legend.Controller}
	 * Legend associated to this map
	 */
	legend: null,

	urlTpl: {
		st: '{0}/context/{1}.json',
		ws: '{0}/context/{1}'
	},

	/**
	 * Init the map component, init the viewModel.
	 * @protected
	 */
	init: function() {
		var v = this.getView();
		
		if(Ck.params.context) {
			v.setContext(Ck.params.context);
		}

		// Create controls
		var olControls = [];
		var control, controls = v.getControls();
		for(var controlName in controls) {
			control = Ck.create("ol.control." + controlName, controls[controlName]);
			if(control) {
				olControls.push(control);
			}
		}
		
		if(controls.ZoomSlider) {			
			v.addCls((controls.ZoomSlider.style)? controls.ZoomSlider.style : "zoomslider-style1");
		}
		
		// Create interactions
		var olInteractions = []
		var interaction, interactions = v.getInteractions();
		for(var interactionName in interactions) {
			interaction = Ck.create("ol.interaction." + interactionName, interactions[interactionName]);
			if(interaction) {
				olInteractions.push(interaction);
			}
		}
		
		// Create the map
		var olMap = new ol.Map({
			view: new ol.View({
				center: v.getCenter(),
				zoom: v.getZoom()
			}),
			controls: olControls,
			interactions: olInteractions
		});
		
		this.bindMap(olMap);
		
		this.on("layersloading", this.layersLoading, this);
		this.on("layersloaded", this.layersLoaded, this);
		this.layersAreLoading = false;
		
		// Relay olMap events
		olMap.getLayers().on('add', function(colEvent) {
			var layer = colEvent.element;
			this.fireEvent('addlayer', layer);
		}, this);
		olMap.getLayers().on('remove', function(colEvent) {
			var layer = colEvent.element;
			this.fireEvent('removelayer', layer);
		}, this);
	},
	
	layersLoading: function() {
		this.layersAreLoading = true;
	},
	
	layersLoaded: function() {
		this.layersAreLoading = false;
	},
	
	/**
	 * Init the context map. Called when map is ready.
	 * @param {undefined/Object} Object with features, id, properties and type members
	 * @protected
	 */
	initContext: function(context) {
		var vm = this.getViewModel();
		
		if(!context) {
			var contextName = this.getView().getContext();
			this.getContext(contextName);
			return;
		}
		
		var owc = new Ck.Owc(context);
		if(!owc) {
			Ck.log("This context is not a OWS context !");
			return;
		}
		
		this.originOwc = owc;
		
		var v = this.getView();
		var olMap = this.getOlMap();
		var olView = this.getOlView();
		
		var viewProj = owc.getProjection();
		var viewScales = owc.getScales();
		
		// Set scales for combobox and olView
		var vmStores = vm.storeInfo;
		vmStores.scales = new Ext.data.Store({
			fields: ['res', 'scale'],
			data: viewScales
		});
		
		vm.setStores(vmStores);
		
		// Reset olView because "set" and "setProperties" method doesn't work for min/maxResolution
		olMap.setView(new ol.View({
			center: v.getCenter(),
			zoom: v.getZoom(),
			minResolution: viewScales[0].res,
			maxResolution: viewScales[viewScales.length-1].res
		}));
		this.bindMap(olMap);
		
		// Remove all layers
		this.getLayers().clear();
		
		// Set the bbox
		this.setExtent(owc.getExtent());
		
		owc.getLayers().forEach(function(lyr) {
			var params, opt_options, layer = owc.getLayer(lyr);
			if(!layer) return;
			
			var olLayer, olLayerType, olSourceOptions, olSource,
				olSourceAdditional = {},
				olStyle = false,
				ckLayerSpec = vm.getData().ckOlLayerConnection[layer.getType()];
			
			if(Ext.isEmpty(ckLayerSpec)) {
				Ck.error("Layer of type " + layer.getType() + " is not supported by Chinook 2.");
			} else {
				switch(layer.getType()) {
					case 'osm':
						olSourceOptions = {
							layer: 'osm'
						};
						break;
						
					case 'wms':
						olSourceOptions = {
							url: layer.getHref(false),
							params: {
								layers: layer.getName(),
								version: layer.getProtocolVersion()
							}
						};
						break;
						
					case "wfs":
						olSourceOptions = {
							loader: function(extent, resolution, projection) {
								var url = this.layer.getHref(true);
								Ext.Ajax.request({
									scope: this,
									url: url,
									useDefaultXhrHeader: false,
									success: function(response) {
										// Reading options (=> reprojection parameters)
										var readingOpt = {
											dataProjection: ol.proj.get("EPSG:4326"),
											featureProjection: projection
										}
										var format = new ol.format.WFS();
										var features = format.readFeatures(response.responseXML, readingOpt);
										
										this.addFeatures(features);
									},
									failure: function() {
										Ck.log('Request getFeature fail for layer ' + this.layer.getTitle());
									}
								});
							}
						};
						olSourceAdditional = {
							layer: layer
						};
						olStyle = Ck.map.Style.style;
						break;
					
					case 'geojson':
						olSourceOptions = {
							url: layer.getHref(false),
							format: new ol.format.GeoJSON()
						};
						olStyle = Ck.map.Style.style;
						break;
				}
				
				var olSource = Ck.create("ol.source." + ckLayerSpec.source, olSourceOptions);
				
				// For vector layer only, if we want a clustered representation
				var cluster = layer.getExtension('cluster');
				if(cluster) {
					// TODO : check if scope is ok with N layers
					var styleCache = {};
					var nbFeatures = false;
					var olSrcVector = olSource;
					var dist = cluster.distance || 60;
					olSource = new ol.source.Cluster({
						distance: dist,
						source: olSrcVector
					});
					olStyle = function(feature, resolution) {
						var size = feature.get('features').length;
						var style = styleCache[size];
						if (!style) {
							var minSize = cluster.minSize || 10;
							var maxSize = cluster.maxSize || cluster.distance || 60;
							if(!nbFeatures) nbFeatures = olSrcVector.getFeatures().length;
							var ptRadius = minSize + ((size * maxSize) / nbFeatures);
							style = [new ol.style.Style({
								image: new ol.style.Circle({
									radius: ptRadius,
									stroke: new ol.style.Stroke({
										color: '#fff'
									}),
									fill: new ol.style.Fill({
										color:	'rgba(51,153,204,0.75)'
									})
								}),
								text: new ol.style.Text({
									text: size.toString(),
									scale: ptRadius * .1,
									fill: new ol.style.Fill({
										color: '#fff'
									})
								})
							})];
							styleCache[size] = style;
						}
						return style;
					}
				}
				
				Ext.apply(olSource, olSourceAdditional);
				var extent = layer.getExtent(viewProj) || owc.getExtent();
				
				// Layer creation	
				olLayer = Ck.create("ol.layer." + ckLayerSpec.layerType, {
					id: layer.getId(),
					title: layer.getTitle(),
					source: olSource,
					extent: extent,
					style: olStyle,
					visible: layer.getVisible(),
					path: layer.getExtension('path')
				});
				
				if(olLayer) {
					// Set specific Chinook parameters
					olLayer.ckParams = {};
					var ckParams = vm.data.ckLayerParams;
					for(var i = 0; i < ckParams.length; i++) {
						olLayer.ckParams[ckParams[i]] = layer.lyr.properties[ckParams[i]];
					}
					
					this.getOlMap().addLayer(olLayer);
				}
			}
		}, this);
		
		// Fire when layers are loaded
		Ck.log('fireEvent ckmapLoaded');
		this.fireEvent('loaded', this);
		Ext.GlobalEvents.fireEvent('ckmapLoaded', this);
	},
	
	/**
	 * Load the context. Called by initContext.
	 * @param {String} The name of the context to load.
	 * @return {Object} The OWS Context. 
	 * @protected
	 */
	getContext: function(contextName) {
		Cks.get({
			url: this.getFullUrl(contextName),
			scope: this,
			success: function(response){
				var owc = Ext.decode(response.responseText);
				this.initContext(owc);
			},
			failure: function(response, opts) {
				Ck.error('Error when loading "'+contextName+'" context !. Loading the default context...');
				this.getContext('ck-default');
			}
		});
	},
	
	/**
	 * Bind the map with the model. Update the model on map moveend event.
	 * @param {ol.Map} olMap
	 * @protected
	 */
	bindMap: function(olMap) {
		var v = this.getView();
		var vm = this.getViewModel();
		
		v.setMap(olMap);
		
		var p = v.getCoordPrecision();
		var olv = olMap.getView();
		
		var proj = olv.getProjection().getCode();
		var units = olv.getProjection().getUnits();
		vm.set('olview.projection.code', proj);
		vm.set('olview.projection.units', units);
		
		olMap.on('moveend', function(e){

			var c = olv.getCenter();
			vm.set('olview.center', c );
			
			var res = olv.getResolution();
			vm.set('olview.resolution', res );
			
			var rot = olv.getRotation();
			vm.set('olview.rotation', rot );
			
			var extent = olv.calculateExtent(olMap.getSize());
			var bl = ol.extent.getBottomLeft(extent);
			var tr = ol.extent.getTopRight(extent);
			vm.set('extent', [
				ol.coordinate.format(bl, '{x}', p),
				ol.coordinate.format(bl, '{y}', p),
				ol.coordinate.format(tr, '{x}', p),
				ol.coordinate.format(tr, '{y}', p)
			]);
			
			var z = olv.getZoom();
			vm.set('zoom', z);
		});
	},
	
	/**
	 * Getter for the viewModel. See Ck.map.Model for the list of avaible configs.
	 *
	 *		 ckmap.get('center')
	 *
	 * @param {String} property The parameter to retrieve
	 * @return {Object/Array/String}
	 */
	get: function(property) {
		return this.getViewModel().get(property);
	},
	
	/**
	 * Setter for the viewModel. See Ck.map.Model for the list of avaible configs.
	 *
	 *		 ckmap.set('center', [10, 10])
	 *
	 * @param {String} property The parameter to update
	 * @param {String} value The value
	 */
	set: function(property, value) {
		return this.getViewModel().set(property, value);
	},
	
	/**
	 * Get the map associated with the controller.
	 * @return {ol.Map} The Ol map
	 */
	getOlMap: function() {
		return this.getView().getMap();
	},
	
	/**
	 * Get the Ol view associated with this map..
	 * @return {ol.View} The view that controls this map. 
	 * @protected
	 */
	getOlView: function() {
		return this.getOlMap().getView();
	},
	
	/**
	 * 
	 */
	getLegend: function() {
		return this.legend;
	},

	/**
	 * Get the map projection.
	 * @return {ol.proj.Projection} proj
	 */
	getProjection: function() {
		return  this.getOlView().getProjection();
	},

	/**
	 * Set the center of the current view.
	 * @param {ol.Coordinate} center An array of numbers representing an xy coordinate. Example: [16, 48].
	 */
	setCenter: function(c) {
		return this.getOlView().setCenter(c);
	},
	
	/**
	 * Set the resolution for this view.
	 * @param {Number} res The resolution of the view.
	 */
	setResolution: function(res) {
		return this.getOlView().setResolution(res);
	},

	/**
	 * Set the rotation for this view.
	 * @param {Number} rot The rotation of the view in radians.
	 */
	setRotation: function(rot) {
		return this.getOlView().setRotation(rot);
	},
	
	/**
	 * Fit the map view to the passed extent.
	 * @param {ol.Extent} extent An array of numbers representing an extent: [minx, miny, maxx, maxy].
	 */
	setExtent: function(extent) {
		return this.getOlView().fit(extent, this.getOlMap().getSize());
	},
	
	/**
	 * Get the current zoom level. Return undefined if the current resolution is undefined or not a "constrained resolution".
	 * @return {Number} zoom
	 */
	getZoom: function() {
		return this.getOlView().getZoom();
	},
	
	/**
	 * Zoom to a specific zoom level.
	 * @param {Number} zoom The zoom level 0-n
	 */
	setZoom: function(zoom) {
		return this.getOlView().setZoom(zoom);
	},
	
	/**
	 * Get the collection of layers associated with this map.
	 * @return {ol.Collection} 
	 */
	getLayers: function() {
		return this.getOlMap().getLayers();
	},
	
	/**
	 * Get a layer by ID.
	 * @return {ol.Layer} 
	 */
	getLayer: function(id) {
		var layers = this.getLayers().getArray();
		// Reverse layer order
		for(li=layers.length-1; li>=0; li--){
			if (id == layers[li].get('id')) {
				return layers[li];
			}
		}
	},
	
	/**
	 * Get all overview layer
	 * @return {ol.layer[]}
	 */
	getOverviewLayers: function() {
		var resLayers = [];
		var layers = this.getLayers().getArray();
		for(var i = 0; i < layers.length; i++) {
			if(layers[i].ckParams && layers[i].ckParams.overviewLayer === true) {
				resLayers.push(layers[i]);
			}
		}
		return resLayers;
	},
	
	/**
	 * Get all layers of a certain type
	 * @param {Constructor}	The constructor of desired layer type
	 * @return {Array}
	 */
	getLayersType: function(type) {
		var lyrs = this.getLayers().getArray();
		var res = [];
		
		for(var i = 0; i < lyrs.length; i++) {
			if(lyrs[i].getVisible() && lyrs[i] instanceof type && lyrs[i].getProperties().id != "measureLayer") {
				res.push(lyrs[i]);
			}
		}
		
		return res;
	},
	
	/**
	 * 
	 */
	getLayersStore: function() {
		var res = [];
		var lyrs = this.getLayers().getArray();
		for(var i = 0; i < lyrs.length; i++) {
			// TODO improve true layer detection
			if(lyrs[i].getProperties().title) {
				res.push({
					"id": lyrs[i].getProperties().title,
					"data": lyrs[i]
				});
			}
		}
		return res;
	},
	
	/**
	 * Return true if at least one layers is loading. False otherwise
	 */
	isLayerLoading: function() {
		return this.layersAreLoading;
	},
	
	/**
	 *	Resize the map when the view is resized.
	 * Render the map if it's not rendered (first call)
	 * @protected
	 */
	resize: function() {
		var v = this.getView();
		var m = this.getOlMap();
		if(!m.isRendered()){
			m.setTarget(v.body.id);
			
			// Fire map ready when it's rendered
			Ck.log('fireEvent ckmapReady');
			this.fireEvent('ready', this);
			Ext.GlobalEvents.fireEvent('ckmapReady', this);
			
			this.initContext();
		} else {
			m.updateSize();
		}
	},
	
	/**
	 * Reset the current view to initial extend
	 */
	resetView: function() {
		this.setExtent(this.originOwc.getExtent());
	},
	
	redraw: function() {
		this.getLayers().forEach(function(layer) {
			var source = layer.getSource();
			if(source.getParams && source.updateParams) {
				var params = source.getParams();
				source.updateParams(params);
			}
		});
	},
	
	/**
	 * Apply the given function to all layers of the map
	 */
	applyFunction: function(fct) {
		this.getLayers().forEach(fct);
	},
	
	applyEffect: function(effectName, layer) {
		var kernel = Ck.normalizeKernel(effectName);
		if(!kernel) {
			return false;
		}
		
		var applyEffect = function(layer) {
			layer.on("postcompose", function(event) {
				Ck.convolve(event.context, kernel);
			})
		}
		
		if(layer) {
			applyEffect(layer);
		} else {
			this.applyFunction(applyEffect);
		}
	}
});
