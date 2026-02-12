## Phase 4: Integration with CarPiggy & Other Projects

### 4.1 **Discord Bot Integration**

```typescript
// carpiggy/src/perplexity-integration.ts
import { ResearchAgent } from './research-agent';

export async function handleResearchCommand(interaction: CommandInteraction, topic: string) {
  await interaction.deferReply();

  const agent = new ResearchAgent(perplexityClient);
  const result = await agent.conductResearch(topic, 'standard');

  // Format for Discord (handle 2000 char limit)
  const embed = new EmbedBuilder()
    .setTitle(`Research: ${topic}`)
    .setDescription(truncate(result.answer, 4000))
    .addFields(
      result.citations?.slice(0, 5).map((cite, i) => ({
        name: `Source ${i + 1}`,
        value: cite.url,
        inline: true,
      })) || [],
    );

  await interaction.editReply({ embeds: [embed] });
}
```

### 4.2 **Vite Dev Tool Integration**

```typescript
// tools/research-cli.ts
import { ResearchAgent } from '../src/research-agent';

async function main() {
  const args = process.argv.slice(2);
  const query = args.join(' ');

  const agent = new ResearchAgent(new PerplexityClient(process.env.PERPLEXITY_API_KEY!));

  console.log('🔍 Researching:', query);

  const result = await agent.conductResearch(query, 'standard');

  console.log('\n📊 Results:\n');
  console.log(result.answer);
  console.log('\n📚 Citations:', result.citations);
  console.log('\n💰 Cost:', calculateCost(result.usage));
}

main();
```

---
