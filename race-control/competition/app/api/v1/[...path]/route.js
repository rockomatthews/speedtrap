import { handle } from "../../../../lib/api.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function dispatch(request, context) {
  return handle(request, (await context.params).path);
}
export { dispatch as GET, dispatch as POST };
