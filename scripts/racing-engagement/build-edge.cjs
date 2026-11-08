// Generate the Deno worker from the same detector/parser used by the review UI.
const fs=require('node:fs');const ts=require('typescript');
const files=['src/lib/racing-engagement/model.ts','src/lib/bookings/time.ts','src/lib/racing-engagement/vms-source.ts','src/lib/racing-engagement/sync.ts'];
const source=files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\n/gm,'')).join('\n');
const prelude=`// @ts-nocheck -- Generated Deno entrypoint; source modules are typechecked in Next.js.
import {XMLValidator,XMLParser} from 'npm:fast-xml-parser@4.5.1';
import {createClient} from 'npm:@supabase/supabase-js@2.49.1';
const BOOKING_TIMEZONE='America/New_York';
const parseXml=(xml)=>new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:true,trimValues:true}).parse(xml);
const VmsClient={fromEnv(){throw Error('Explicit read-only adapter required');}};
`;
const handler=fs.readFileSync('scripts/racing-engagement/edge-handler.txt','utf8');
fs.writeFileSync('supabase/functions/racing-shadow/index.ts',prelude+ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText+handler);
