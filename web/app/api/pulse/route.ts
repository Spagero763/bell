import {NextResponse} from "next/server";
import {getPulse} from "@/lib/pulse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const pulse = await getPulse();
    return NextResponse.json(pulse, {headers: {"cache-control": "no-store"}});
  } catch {
    return NextResponse.json({error: "upstream unavailable"}, {status: 503});
  }
}
