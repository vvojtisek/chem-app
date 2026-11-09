import { notFound } from "next/navigation";

import { mathTopics } from "@inorganic/content/higher-mathematics";
import { HigherMathematicsPractice } from "@/components/higher-mathematics-practice";
import { PageHeader } from "@/components/page-header";
import { PRACTICE_BREADCRUMB } from "@/components/practice-breadcrumb";

export function generateStaticParams() {
  return mathTopics.map((topic) => ({ topicId: topic.id }));
}

export default async function HigherMathematicsTopicPage({
  params,
}: PageProps<"/procvicovani/matematika/[topicId]">) {
  const { topicId } = await params;
  const topic = mathTopics.find((candidate) => candidate.id === topicId);
  if (!topic) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[
          PRACTICE_BREADCRUMB,
          { label: "Vyšší matematika", href: "/procvicovani/matematika" },
          { label: topic.title },
        ]}
        description={topic.description}
        title={topic.title}
      />
      <HigherMathematicsPractice key={topic.id} topic={topic} />
    </main>
  );
}
