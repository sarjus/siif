import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes are protected by client-side auth checks in the pages
  // This middleware just handles basic redirects if needed
  
  // If already logged in and trying to access login page, keep the request
  // The page will handle any necessary redirects
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/reviewer/:path*', '/company/:path*'],
};
