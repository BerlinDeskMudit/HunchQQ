import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg space-y-3 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-gray-400">
        That page or market doesn&apos;t exist (or the IDL/RPC isn&apos;t configured).
      </p>
      <Link href="/" className="btn-primary inline-flex">
        Back to markets
      </Link>
    </div>
  );
}
