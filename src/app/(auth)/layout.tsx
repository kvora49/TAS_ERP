export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] w-full bg-[#F1F5F9] text-[#374151] antialiased overflow-x-hidden">
      {children}
    </div>
  );
}
