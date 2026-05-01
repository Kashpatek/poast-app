import { ProjectClient } from "./project-client";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectClient projectId={id} />;
}
