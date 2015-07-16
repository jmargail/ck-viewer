/**
 * 
 */

Ext.define("ck.Legend", {
	extend: "Ext.tree.Panel",
	alias: "widget.cklegend",
	
	requires: [
		'ck.legend.*'
	],

	controller: "cklegend",
	
	viewModel: {
		type: "cklegend"
	},

	plugins: [
		'legendchecker',
		'legendlayeredit',
		'legendlayerzoom'
	],
	
	viewConfig: {
		plugins: { 
			ptype: 'treeviewdragdrop' 
		}
	},
	
	config: {
		map: null
	},
	
	useArrows: true,
	rootVisible: false,
	hideHeaders: true,
	
	cls: 'ck-legend',
	
	columns: [{
		xtype: 'treecolumn',
		text: 'Layers',
		dataIndex: 'text',
		flex: 1
	},{
		xtype: 'actioncolumn'
	}]
});
