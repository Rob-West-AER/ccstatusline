import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetEditorProps,
    WidgetItem
} from '../types/Widget';
import { getContextWindowMetrics } from '../utils/context-window';
import { shouldInsertInput } from '../utils/input-guards';
import { formatTokens } from '../utils/renderer';
import { makeUsageProgressBar } from '../utils/usage';

import { makeSliderBar } from './shared/usage-display';

type DisplayMode = 'progress' | 'progress-short' | 'slider' | 'slider-only';

const DEFAULT_CONTEXT_LIMIT = 150000;
const PREVIEW_USED_TOKENS = 50000;

function getDisplayMode(item: WidgetItem): DisplayMode {
    const mode = item.metadata?.display;
    if (mode === 'progress' || mode === 'slider' || mode === 'slider-only') {
        return mode;
    }
    return 'progress-short';
}

function isBarSliderMode(mode: DisplayMode): boolean {
    return mode === 'slider' || mode === 'slider-only';
}

/**
 * Parse a user-entered token limit. Accepts a plain integer (e.g. "150000")
 * or a value with a k/m suffix (e.g. "150k", "1.5m"). Returns null when the
 * input is empty or not a positive number.
 */
function parseLimit(raw: string | undefined): number | null {
    if (!raw) {
        return null;
    }
    const trimmed = raw.trim().toLowerCase();
    const match = /^(\d+(?:\.\d+)?)\s*([km])?$/.exec(trimmed);
    if (!match?.[1]) {
        return null;
    }
    const value = parseFloat(match[1]);
    if (!isFinite(value) || value <= 0) {
        return null;
    }
    const suffix = match[2];
    const multiplier = suffix === 'm' ? 1000000 : suffix === 'k' ? 1000 : 1;
    return Math.round(value * multiplier);
}

function getLimit(item: WidgetItem): number {
    return parseLimit(item.metadata?.limit) ?? DEFAULT_CONTEXT_LIMIT;
}

export class ContextLimitBarWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Context usage as a bar against a configurable token limit'; }
    getDisplayName(): string { return 'Context Limit Bar'; }
    getCategory(): string { return 'Context'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const mode = getDisplayMode(item);
        const modifiers: string[] = [`limit ${formatTokens(getLimit(item), 0)}`];

        if (mode === 'progress-short') {
            modifiers.push('medium bar');
        } else if (mode === 'slider') {
            modifiers.push('short bar');
        } else if (mode === 'slider-only') {
            modifiers.push('short bar only');
        }

        return {
            displayText: this.getDisplayName(),
            modifierText: `(${modifiers.join(', ')})`
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action !== 'toggle-progress') {
            // 'edit-limit' (and anything else) falls through to renderEditor.
            return null;
        }

        const currentMode = getDisplayMode(item);
        const nextMode: DisplayMode = currentMode === 'progress-short'
            ? 'progress'
            : currentMode === 'progress'
                ? 'slider'
                : currentMode === 'slider'
                    ? 'slider-only'
                    : 'progress-short';

        return {
            ...item,
            metadata: {
                ...(item.metadata ?? {}),
                display: nextMode
            }
        };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const displayMode = getDisplayMode(item);
        const total = getLimit(item);

        let used: number | null;
        if (context.isPreview) {
            used = PREVIEW_USED_TOKENS;
        } else {
            const contextWindowMetrics = getContextWindowMetrics(context.data);
            used = contextWindowMetrics.contextLengthTokens;
            if (used === null && context.tokenMetrics) {
                used = context.tokenMetrics.contextLength;
            }
        }

        if (used === null || total <= 0) {
            return null;
        }

        // Percentage is intentionally NOT clamped for display, so usage past the
        // configured limit reads above 100%. Only the bar fill is clamped.
        const percent = (used / total) * 100;
        const clampedPercent = Math.max(0, Math.min(100, percent));
        const usedDisplay = formatTokens(used, 0);
        const totalDisplay = formatTokens(total, 0);
        const percentText = `${Math.round(percent)}%`;

        if (isBarSliderMode(displayMode)) {
            const slider = makeSliderBar(clampedPercent);
            const sliderDisplay = displayMode === 'slider' ? `${slider} ${usedDisplay}/${totalDisplay} (${percentText})` : slider;
            return item.rawValue ? sliderDisplay : `Smart zone: ${sliderDisplay}`;
        }

        const barWidth = displayMode === 'progress' ? 32 : 16;
        const display = `${makeUsageProgressBar(clampedPercent, barWidth)} ${usedDisplay}/${totalDisplay} (${percentText})`;

        return item.rawValue ? display : `Smart zone: ${display}`;
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [
            { key: 'p', label: '(p)rogress toggle', action: 'toggle-progress' },
            { key: 'l', label: '(l)imit', action: 'edit-limit' }
        ];
    }

    renderEditor(props: WidgetEditorProps): React.ReactElement | null {
        if (props.action === 'edit-limit') {
            return <ContextLimitEditor {...props} />;
        }
        return null;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

const ContextLimitEditor: React.FC<WidgetEditorProps> = ({ widget, onComplete, onCancel }) => {
    const [text, setText] = useState(widget.metadata?.limit ?? '');
    const parsed = parseLimit(text);
    const hasInput = text.trim().length > 0;
    const isValid = hasInput && parsed !== null;

    useInput((input, key) => {
        if (key.return) {
            if (!isValid) {
                return;
            }
            onComplete({
                ...widget,
                metadata: {
                    ...(widget.metadata ?? {}),
                    limit: text.trim()
                }
            });
        } else if (key.escape) {
            onCancel();
        } else if (key.backspace || key.delete) {
            setText(prev => prev.slice(0, -1));
        } else if (shouldInsertInput(input, key) && /^[0-9.kmKM]+$/.test(input)) {
            setText(prev => prev + input);
        }
    });

    const hint = isValid
        ? `= ${formatTokens(parsed, 0)} tokens`
        : hasInput
            ? 'Invalid value'
            : 'Digits with an optional k/m suffix (e.g. 150000 or 150k)';

    return (
        <Box flexDirection='column'>
            <Text>
                Enter context limit:
                {' '}
                {text}
                <Text inverse> </Text>
            </Text>
            <Text dimColor>{hint}</Text>
            <Text dimColor>Enter save, ESC cancel, Backspace delete</Text>
        </Box>
    );
};
