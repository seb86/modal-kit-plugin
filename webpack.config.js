/**
 * Extends the `@wordpress/scripts` config (block entries from block.json)
 * with the plugin's own editor and admin entry points.
 */
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

const ENTRIES = {
	'editor/index': './src/editor/index.js',
	'extensions/video-lightbox': './src/extensions/video-lightbox/index.js',
	'admin/list': './src/admin/list/index.js',
	'admin/settings': './src/admin/settings/index.js',
	'admin/wizard': './src/admin/wizard/index.js',
};

const [ scriptConfig, ...moduleConfigs ] = Array.isArray( defaultConfig )
	? defaultConfig
	: [ defaultConfig ];

module.exports = [
	{
		...scriptConfig,
		entry: () => ( {
			...( typeof scriptConfig.entry === 'function'
				? scriptConfig.entry()
				: scriptConfig.entry ),
			...ENTRIES,
		} ),
		// The fixed styles' token files, read by Styles.php.
		plugins: [
			...scriptConfig.plugins,
			new CopyWebpackPlugin( {
				patterns: [ { from: 'styles/*.json', context: 'src' } ],
			} ),
		],
	},
	// Lazily imported runtime chunks (triggers) go in build/runtime/.
	...moduleConfigs.map( ( config ) => ( {
		...config,
		output: {
			...config.output,
			chunkFilename: 'runtime/[name].js?ver=[contenthash]',
		},
	} ) ),
];
