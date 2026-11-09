// The bundle entry for dist/runtime.js: boot once the page is parsed.
import { boot } from './main.js';

document.addEventListener('DOMContentLoaded', boot);
