import { defineConfig } from 'vitest/config';

export default defineConfig( {
	test: {
		include: [ 'src/**/*.test.js', 'tests/js/**/*.test.js' ],
		environment: 'node',
		globals: false,
		restoreMocks: true,
	},
} );
