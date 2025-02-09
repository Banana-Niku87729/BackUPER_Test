import { createBot, getBotIdFromToken, startBot, Intents, CreateSlashApplicationCommand, Bot, Interaction, InteractionResponseTypes, addRole, createRole, getGuildRoles, hasRole, snowflakeToBigint } from "@discordeno/mod.ts";
import "$std/dotenv/load.ts";

interface SlashCommand {
    info: CreateSlashApplicationCommand;
    response(bot: Bot, interaction: Interaction): Promise<void>;
};

// Botのトークンを.envから取得
const BotToken: string = Deno.env.get("BOT_TOKEN")!;

// `hello_world` コマンド
const HelloCommand: SlashCommand = {
    info: {
        name: "hello_world",
        description: "こんにちはと返します。",
    },
    response: async (bot, interaction) => {
        return await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: {
                content: "こんにちは",
                flags: 1 << 6,
            },
        });
    },
};

// `userguard` コマンド
const roleName = "safeuser";
const defaultColor = 0x0000FF;

const UserGuardCommand: SlashCommand = {
    info: {
        name: "user-guard",
        description: "指定されたユーザーに「safeuser」ロールを付与します。",
        options: [
            {
                name: "target",
                description: "ロールを付与するユーザー",
                type: 6, // USER型
                required: true,
            },
        ],
    },
    response: async (bot, interaction) => {
        if (!interaction.guildId) {
            return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: 4,
                data: {
                    content: "このコマンドはサーバー内でのみ使用できます。",
                    flags: 64,
                },
            });
        }

        const targetId = interaction.data?.options?.[0]?.value as string;
        const guildId = interaction.guildId;
        const memberId = snowflakeToBigint(targetId);
        const guildRoles = await getGuildRoles(guildId);
        let role = guildRoles.find((r) => r.name === roleName);

        try {
            if (!role) {
                role = await createRole(guildId, {
                    name: roleName,
                    color: defaultColor,
                    reason: "Userguard role creation",
                });
                bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                    type: 4,
                    data: {
                        content: `「${roleName}」ロールを作成しました。`,
                        flags: 64,
                    },
                });
            }

            if (await hasRole(guildId, memberId, role.id)) {
                return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                    type: 4,
                    data: {
                        content: `<@${targetId}> には既に「${roleName}」ロールが付与されています。`,
                        flags: 64,
                    },
                });
            }

            await addRole(guildId, memberId, role.id);
            return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: 4,
                data: {
                    content: `<@${targetId}> に「${roleName}」ロールを付与しました。`,
                    flags: 64,
                },
            });
        } catch (error) {
            console.error(error);
            return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: 4,
                data: {
                    content: `コマンド実行中にエラーが発生しました: ${error.message}`,
                    flags: 64,
                },
            });
        }
    },
};

// ボットの作成
const bot = createBot({
    token: BotToken,
    botId: getBotIdFromToken(BotToken) as bigint,
    intents: Intents.Guilds | Intents.GuildMessages,

    events: {
        ready: (_bot, payload) => {
            console.log(`${payload.user.username} is ready!`);
        },
        interactionCreate: async (_bot, interaction) => {
            if (interaction.data?.name === "hello_world") {
                await HelloCommand.response(bot, interaction);
            } else if (interaction.data?.name === "userguard") {
                await UserGuardCommand.response(bot, interaction);
            }
        },
    },
});

// コマンドの登録
bot.helpers.upsertGlobalApplicationCommands([HelloCommand.info, UserGuardCommand.info]);

await startBot(bot);
