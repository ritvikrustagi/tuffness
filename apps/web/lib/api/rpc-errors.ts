import { NextResponse } from "next/server";

type RpcError = {
  code?: string;
  message: string;
};

export function rpcErrorResponse(error: RpcError) {
  if (error.code === "42501") {
    return NextResponse.json({ error: error.message || "Forbidden" }, { status: 403 });
  }

  if (error.code === "P0002") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error.code === "23505" || error.code === "23514") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
