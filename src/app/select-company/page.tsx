import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { switchCompany } from "@/app/actions/switch-company";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Building2, ArrowRight, ShieldCheck, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SelectCompanyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Fetch active company memberships
  const { data: memberships, error } = await supabase
    .from("company_members")
    .select(`
      id,
      role,
      status,
      businesses (
        id,
        name,
        gstin,
        address,
        logo_url,
        phone,
        email
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const validMemberships = (memberships || []).filter((m) => m.businesses);

  // 2. If exactly 1 company, auto-select and proceed to dashboard
  if (validMemberships.length === 1) {
    const singleCompanyId = (validMemberships[0].businesses as any).id;
    await switchCompany(singleCompanyId);
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-body)] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header Block */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] shadow-md p-2 mb-2">
            <img src="/logo.png" alt="TAS ERP Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Select Company Workspace
          </h1>
          <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Choose the company workspace you want to operate in for this session.
          </p>
        </div>

        {/* Empty state: 0 companies */}
        {validMemberships.length === 0 ? (
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                No Active Workspaces Found
              </h3>
              <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                Your account is not linked to any active company yet. Please contact your company administrator or register a new company.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
              >
                <Plus size={16} />
                <span>Create a Company</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Multi-company Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {validMemberships.map((membership) => {
              const company = membership.businesses as any;
              return (
                <form
                  key={company.id}
                  action={switchCompany.bind(null, company.id)}
                  className="w-full"
                >
                  <button
                    type="submit"
                    className="w-full h-full bg-[var(--card-bg)] hover:bg-[var(--page-bg)] border border-[var(--border)] hover:border-[var(--primary)] rounded-2xl p-5 text-left transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[var(--page-bg)] border border-[var(--border)] flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          {company.logo_url ? (
                            <img
                              src={company.logo_url}
                              alt={company.name}
                              className="w-full h-full object-contain p-0.5"
                            />
                          ) : (
                            <Building2 size={20} className="text-[var(--text-muted)]" />
                          )}
                        </div>
                        <RoleBadge role={membership.role} />
                      </div>

                      <div className="mt-4">
                        <h2 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors truncate">
                          {company.name}
                        </h2>
                        {company.gstin && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate font-mono">
                            GSTIN: {company.gstin}
                          </p>
                        )}
                        {company.address && (
                          <p className="text-xs text-[var(--text-faint)] mt-1 truncate">
                            {company.address}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-[var(--border-light)] flex items-center justify-between text-xs font-semibold text-[var(--primary)]">
                      <span>Launch Workspace</span>
                      <ArrowRight
                        size={15}
                        className="transform group-hover:translate-x-1 transition-transform"
                      />
                    </div>
                  </button>
                </form>
              );
            })}
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center text-xs text-[var(--text-faint)] flex items-center justify-center gap-1.5 pt-4">
          <ShieldCheck size={14} className="text-[var(--primary)]" />
          <span>Secure multi-tenant isolation powered by Row-Level Security</span>
        </div>
      </div>
    </div>
  );
}
