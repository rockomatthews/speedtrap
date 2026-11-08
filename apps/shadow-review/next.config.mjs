import {fileURLToPath} from 'node:url';
export default {outputFileTracingRoot:fileURLToPath(new URL('.',import.meta.url)),async headers(){return [{source:'/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Cache-Control',value:'no-store'}]}];}};
