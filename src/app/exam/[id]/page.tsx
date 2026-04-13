export default async function CATExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex flex-col p-8">
      <h1 className="text-3xl font-bold">Exam</h1>
      <p className="mt-2 text-zinc-600">Exam ID: {id}</p>
    </main>
  );
}
