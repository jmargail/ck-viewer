/**
 * Edit tool used to delete a feature
 */
Ext.define('Ck.edit.action.Delete', {
	extend: 'Ck.edit.Action',
	alias: 'widget.ckEditDelete',

	/**
	 * Default properties when this action is used through a button
	 */
	iconCls: 'fa fa-remove fa-lg fa-flip-horizontal ck-plugin',
	tooltip: 'Delete feature',

	toggleAction: function(btn, status) {
		this.used = true;
		var source = this.getLayerSource();
		
		// this.map.getOlMap().registerRemoveEvent(source);
		
		if(!this.delInteraction) {
			this.delInteraction = new ol.interaction.Select({
				layers: [this.layer],
				style: new ol.style.Style({
					stroke: new ol.style.Stroke({
						color: 'yellow',
						width: 3
					}),
					fill: new ol.style.Fill({
						color: 'rgba(0, 0, 255, 0.1)'
					})
				})
			});
			
			this.delInteraction.on('select', function(e) {
				if(e.selected.length != 0) {
					var feature = e.selected[0];
					
					if(this.deleteConfirmation) {
						Ext.Msg.show({
							title: "Edition",
							message: "Are you sure to delete this feature ?",
							buttons: Ext.Msg.YESNO,
							icon: Ext.Msg.QUESTION,
							fn: function(btn) {
								if (btn === 'yes') {
									source.removeFeature(feature);
								}
							}
						});
					} else {
						source.removeFeature(feature);
					}
					this.delInteraction.getFeatures().clear();
				}
			}, this);
		   
			this.map.getOlMap().addInteraction(this.delInteraction);
		}

		this.delInteraction.setActive(status);
	},
	
	
	closeAction: function() {
		this.map.getOlMap().removeInteraction(this.drawInteraction);
	}
});