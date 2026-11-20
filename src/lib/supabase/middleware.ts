import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPatientAuthEmail } from "@/lib/phone";

type UserRole = "super_admin" | "admin" | "general" | "patient";

function homeForRole(role: UserRole | null): string {
  if (role === "patient") return "/me";
  if (role === "super_admin" || role === "admin" || role === "general") {
    return "/patients";
  }
  return "/login";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" || path === "/" || path.startsWith("/auth");

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  let role: UserRole | null = null;
  if (user) {
    if (isPatientAuthEmail(user.email)) {
      role = "patient";
    } else {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        role = (profile?.role as UserRole | undefined) ?? null;
      } catch {
        role = null;
      }
    }
  }

  if (user && (path === "/login" || path === "/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = homeForRole(role);
    return NextResponse.redirect(redirectUrl);
  }

  if (
    user &&
    role === "patient" &&
    (path.startsWith("/patients") || path.startsWith("/checked-in"))
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/me";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && path.startsWith("/me") && role && role !== "patient") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/patients";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
