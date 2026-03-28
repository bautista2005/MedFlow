import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "App Router limpio",
    description:
      "Las pantallas publicas viven en un route group dedicado y el layout compartido evita duplicar estructura.",
  },
  {
    title: "UI reutilizable",
    description:
      "Botones, cards, inputs y labels quedan centralizados en components/ui con el estilo de shadcn/ui.",
  },
  {
    title: "Supabase preparado",
    description:
      "Helpers de browser y server listos para sumar auth, lecturas y mutaciones sin repartir clients por todo el proyecto.",
  },
];

export function FeatureGrid() {
  return (
    <section className="grid gap-5 md:grid-cols-3">
      {features.map((feature) => (
        <Card
          key={feature.title}
          className="border-white/65 bg-white/82 shadow-[0_16px_50px_rgba(8,73,61,0.08)]"
        >
          <CardHeader>
            <CardTitle>{feature.title}</CardTitle>
            <CardDescription>{feature.description}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,_#1daa74,_#0c6e55)]" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
