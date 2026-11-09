/**
 * Valida src/data/trip.ts contra os schemas zod. Roda no build (`npm run build`)
 * e pode ser chamado direto: `npm run validar`.
 */
import { trip } from "../src/data/trip";
import { TripSchema } from "../src/data/schema";

const r = TripSchema.safeParse(trip);
if (!r.success) {
  console.error("\n✖ trip.ts tem problemas:\n");
  for (const i of r.error.issues) console.error(`  • ${i.path.join(".") || "(geral)"}: ${i.message}`);
  console.error("");
  process.exit(1);
}

const t = r.data!;
const citados = new Set<string>();
for (const d of t.dias) {
  for (const b of [d.manha, d.tarde, d.porDoSol, d.noite]) {
    for (const i of b?.itens ?? []) if (i.local) citados.add(i.local);
  }
}
const soltos = t.locais.filter((l) => !citados.has(l.id));
if (soltos.length) console.warn(`  aviso: locais que nenhum dia cita: ${soltos.map((l) => l.id).join(", ")}`);

console.log(
  `✔ trip.ts válido: ${t.paises.length} países, ${t.cidades.length} cidades, ${t.locais.length} locais, ` +
    `${t.trechos.length} trechos, ${t.dias.length} dias, ${t.reservas.length} reservas.`,
);
