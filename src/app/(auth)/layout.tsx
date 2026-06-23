export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#374151] antialiased">
      {children}
    </div>
  );
}
