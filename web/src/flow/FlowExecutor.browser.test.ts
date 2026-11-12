import { MessageLevel } from "#common/messages";

import { showMessage } from "#elements/messages/MessageContainer";

import { FlowExecutor } from "#flow/FlowExecutor";

import {
    ChallengeTypes,
    ContextualFlowInfoLayoutEnum,
    FlowMessage,
    FlowMessageLevelEnum,
    FlowsApi,
} from "@goauthentik/api";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("#elements/messages/MessageContainer", async (importOriginal) => ({
    ...(await importOriginal<typeof import("#elements/messages/MessageContainer")>()),
    showMessage: vi.fn(),
}));

const mounted = new Set<HTMLElement>();

afterEach(() => {
    document.querySelectorAll("form[data-test-autosubmit]").forEach((form) => form.remove());

    for (const element of mounted) {
        element.remove();
    }

    mounted.clear();
    vi.mocked(showMessage).mockClear();
    vi.restoreAllMocks();
});

it("preserves and disables the current stage during autosubmit navigation", async () => {
    vi.spyOn(FlowsApi.prototype, "flowsExecutorSolve").mockResolvedValue({
        component: "ak-stage-autosubmit",
        url: "https://example.com/sso",
        attrs: { SAMLResponse: "response" },
    });

    const formSubmit = vi
        .spyOn(HTMLFormElement.prototype, "submit")
        .mockImplementation(function submit(this: HTMLFormElement) {
            this.dataset.testAutosubmit = "true";
        });

    const executor = new FlowExecutor();

    const currentChallenge = {
        component: "ak-stage-authenticator-validate",
    } as ChallengeTypes;

    executor.flowSlug = "test-flow";
    executor.challenge = currentChallenge;

    await executor.submit({ component: "ak-stage-authenticator-validate" }, { invisible: true });

    expect(formSubmit).toHaveBeenCalledOnce();
    expect(executor.challenge).toBe(currentChallenge);
    expect(executor.inert).toBe(true);
});

describe("Flow messages", () => {
    const sent: FlowMessage = {
        level: FlowMessageLevelEnum.Success,
        message: "Email Successfully sent.",
    };

    function shellChallenge(
        messages: FlowMessage[],
        layout: ContextualFlowInfoLayoutEnum = ContextualFlowInfoLayoutEnum.Stacked,
    ): ChallengeTypes {
        return {
            component: "xak-flow-shell",
            body: "",
            flowInfo: { title: "Test flow", cancelUrl: "", layout, messages },
        } as ChallengeTypes;
    }

    async function mount(initial: ChallengeTypes): Promise<FlowExecutor> {
        vi.spyOn(FlowsApi.prototype, "flowsExecutorGet").mockResolvedValue(initial);

        const executor = new FlowExecutor();

        executor.flowSlug = "test-flow";

        document.body.append(executor);
        mounted.add(executor);

        await vi.waitFor(() => expect(executor.challenge).toBe(initial));
        await executor.updateComplete;

        return executor;
    }

    it("displays the messages sent with the first challenge", async () => {
        await mount(shellChallenge([sent]));

        expect(showMessage).toHaveBeenCalledExactlyOnceWith({
            level: MessageLevel.success,
            message: sent.message,
        });
    });

    it("displays the messages sent with the challenge returned by a submission", async () => {
        const executor = await mount(shellChallenge([]));

        vi.spyOn(FlowsApi.prototype, "flowsExecutorSolve").mockResolvedValue(
            shellChallenge([sent]),
        );

        await executor.submit({});
        await executor.updateComplete;

        expect(showMessage).toHaveBeenCalledExactlyOnceWith({
            level: MessageLevel.success,
            message: sent.message,
        });
    });

    it("displays the messages when the layout uses a sidebar frame background", async () => {
        await mount(
            shellChallenge([sent], ContextualFlowInfoLayoutEnum.SidebarLeftFrameBackground),
        );

        expect(showMessage).toHaveBeenCalledExactlyOnceWith({
            level: MessageLevel.success,
            message: sent.message,
        });
    });
});
