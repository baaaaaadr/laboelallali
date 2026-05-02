import HomeClientV2 from './HomeClientV2';

type PageProps = {
  params: { lang: string };
};

export default async function HomeV2Page({ params }: PageProps) {
  const { lang } = await params;
  return <HomeClientV2 lang={lang} />;
}
