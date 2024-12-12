import type {
  LanguageModelV1CallOptions,
	Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
	LanguageModelV1StreamPart,
} from "ai";

type Logger = (data: {
  label?: string;
  type: "generate" | "stream";
  input: LanguageModelV1CallOptions["prompt"];
  output: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}) => void;

export const logging = (logger: Logger, label?: string): LanguageModelV1Middleware => ({
	wrapGenerate: async ({ doGenerate, params }) => {
		const result = await doGenerate();

    const {
      promptTokens,
      completionTokens
    } = result.usage;

		logger({
			label,
			type: "generate",
			input: params.prompt,
			output: result.text ?? "",
			usage: {
        promptTokens,
        completionTokens,
			},
		});

		return result;
	},

	wrapStream: async ({ doStream, params }) => {
		const { stream, ...rest } = await doStream();

		let generatedText = "";

		const transformStream = new TransformStream<
			LanguageModelV1StreamPart,
			LanguageModelV1StreamPart
		>({
			transform(chunk, controller) {
				if (chunk.type === "text-delta") {
					generatedText += chunk.textDelta;
				}

				controller.enqueue(chunk);
			},

			flush() {
				logger({
					label,
					type: "stream",
					input: params.prompt,
					output: generatedText,
          // TODO: meta handling
					usage: {
						promptTokens: 0,
						completionTokens: 0,
					},
				});
			},
		});

		return {
			stream: stream.pipeThrough(transformStream),
			...rest,
		};
	},
});
