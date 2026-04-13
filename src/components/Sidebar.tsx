import BravocademyLogo from "./Logo";

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-64 h-full border-r border-zinc-200 p-4 gap-4">
      <BravocademyLogo />
      <nav className="flex flex-col gap-2 text-sm text-zinc-700">
        <a href="/dashboard" className="hover:text-zinc-950">Dashboard</a>
      </nav>
    </aside>
  );
}
