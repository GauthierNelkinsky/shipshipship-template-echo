<script lang="ts">
    import { api } from "$lib/api";
    import type { ReactionSummary } from "$lib/types";
    import { ThumbsUp } from "lucide-svelte";

    interface Props {
        eventId: number;
        initialReactions?: ReactionSummary; // Optional: reaction_summary from event API
    }

    let { eventId, initialReactions = $bindable() }: Props = $props();

    let upvoteCount = $state(0);
    let isUpvoted = $state(false);
    let loading = $state(false);
    let error = $state("");

    // Use $effect to handle initialReactions reactively
    $effect(() => {
        if (initialReactions) {
            const thumbsUpReaction = initialReactions.reactions?.find(
                (r: any) => r.reaction_type === "thumbs_up",
            );
            upvoteCount = thumbsUpReaction?.count || 0;
            isUpvoted =
                initialReactions.user_reactions?.includes("thumbs_up") || false;
        } else {
            loadReactions();
        }
    });

    async function loadReactions() {
        try {
            const data = await api.getEventReactions(eventId);
            const thumbsUpReaction = data.reactions?.find(
                (r) => r.reaction_type === "thumbs_up",
            );
            upvoteCount = thumbsUpReaction?.count || 0;
            isUpvoted = data.user_reactions?.includes("thumbs_up") || false;
        } catch (err) {
            console.error("Failed to load reactions:", err);
        }
    }

    async function toggleUpvote() {
        if (loading) return;

        loading = true;
        error = "";

        try {
            const result = await api.addOrRemoveReaction(eventId, "thumbs_up");

            // Update local state based on the result
            const thumbsUpReaction = result.summary.reactions?.find(
                (r) => r.reaction_type === "thumbs_up",
            );
            upvoteCount = thumbsUpReaction?.count || 0;
            isUpvoted =
                result.summary.user_reactions?.includes("thumbs_up") || false;
        } catch (err: any) {
            error = err.message || "Failed to update upvote";
            setTimeout(() => {
                error = "";
            }, 3000);
        } finally {
            loading = false;
        }
    }
</script>

<div class="inline-flex items-center gap-2">
    <button
        type="button"
        onclick={toggleUpvote}
        disabled={loading}
        class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed {isUpvoted
            ? 'bg-primary/10 border-primary text-primary'
            : 'bg-background border-border hover:bg-muted hover:border-muted-foreground/20'}"
        title="{isUpvoted ? 'Remove upvote' : 'Upvote'} ({upvoteCount})"
    >
        <ThumbsUp class="h-3.5 w-3.5 {isUpvoted ? 'fill-current' : ''}" />
        {#if upvoteCount > 0}
            <span class={isUpvoted ? "text-primary" : "text-muted-foreground"}>
                {upvoteCount}
            </span>
        {/if}
    </button>

    {#if error}
        <span class="text-xs text-destructive">{error}</span>
    {/if}
</div>

<style>
    button {
        transition-property: all;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 200ms;
    }
</style>
