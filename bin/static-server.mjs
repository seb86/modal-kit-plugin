/**
 * A minimal static file server for the exported site: folders serve their
 * index.html, everything else is served as is with a sensible content type.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp',
	'.woff2': 'font/woff2',
	'.xml': 'application/xml',
	'.txt': 'text/plain; charset=utf-8',
};

/**
 * Serves a folder.
 *
 * @param {string} root Folder.
 * @param {number} port Port.
 * @return {Promise<import('node:http').Server>} Server.
 */
export function serve( root, port ) {
	const base = resolve( root );

	const server = createServer( ( request, response ) => {
		const url = new URL( request.url, 'http://localhost' );
		let file = normalize(
			join( base, decodeURIComponent( url.pathname ) )
		);

		if ( ! file.startsWith( base ) ) {
			response.writeHead( 403 ).end();
			return;
		}

		if ( existsSync( file ) && statSync( file ).isDirectory() ) {
			file = join( file, 'index.html' );
		}

		if ( ! existsSync( file ) ) {
			response
				.writeHead( 404, { 'content-type': 'text/plain' } )
				.end( 'Not found' );
			return;
		}

		response.writeHead( 200, {
			'content-type':
				TYPES[ extname( file ).toLowerCase() ] ??
				'application/octet-stream',
		} );
		createReadStream( file ).pipe( response );
	} );

	return new Promise( ( done ) =>
		server.listen( port, () => done( server ) )
	);
}
