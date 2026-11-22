import { handleDesk } from "../../../../../lib/cloud-desk.mjs";
export const dynamic="force-dynamic";
export const runtime="nodejs";
async function dispatch(request,{params}) {
  return handleDesk(request,(await params).path);
}
export { dispatch as GET, dispatch as POST };
