/**
 * 
 */
Ext.define('Ck.map.action.select.Point', {
	extend: 'Ck.map.action.Select',
	alias: 'widget.ckmapSelectPoint',
	
	itemId: 'selectpoint',
	text: '',
	iconCls: 'fa fa-asterisk',
	tooltip: 'Select by click',
		
	//continueMsg: 'Click to select a feature',

	/**
	 * length or area
	 */
	type: 'point'
});
