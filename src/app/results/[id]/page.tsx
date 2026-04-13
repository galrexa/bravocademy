export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex flex-col p-8">
      <h1 className="text-3xl font-bold">Results</h1>
      <p className="mt-2 text-zinc-600">Results for exam: {id}</p>
    </main>
  );
}
