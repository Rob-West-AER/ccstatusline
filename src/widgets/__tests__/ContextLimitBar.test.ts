import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type { RenderContext } from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import * as usage from '../../utils/usage';
import { ContextLimitBarWidget } from '../ContextLimitBar';

const emptyTokenMetrics = {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    totalTokens: 0
};

describe('ContextLimitBarWidget', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(usage, 'makeUsageProgressBar').mockImplementation((percent: number, width = 15) => `[bar:${percent.toFixed(1)}:${width}]`);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('defaults to a 130k limit when no metadata is set', () => {
        const context: RenderContext = {
            data: {
                context_window: {
                    context_window_size: 200000,
                    current_usage: {
                        input_tokens: 20000,
                        output_tokens: 10000,
                        cache_creation_input_tokens: 5000,
                        cache_read_input_tokens: 5000
                    }
                }
            }
        };
        const widget = new ContextLimitBarWidget();

        // contextLength = 20k input + 5k + 5k cache = 30k; 30k / 130k = 23%
        expect(widget.render({ id: 'ctx', type: 'context-limit-bar' }, context, DEFAULT_SETTINGS)).toBe('Smart zone: [bar:23.1:16] 30k/130k (23%)');
    });

    it('uses a custom integer limit from metadata', () => {
        const context: RenderContext = {
            data: { model: { id: 'claude-3-5-sonnet-20241022' } },
            tokenMetrics: { ...emptyTokenMetrics, contextLength: 50000 }
        };
        const widget = new ContextLimitBarWidget();

        expect(widget.render({
            id: 'ctx',
            type: 'context-limit-bar',
            metadata: { limit: '100000' }
        }, context, DEFAULT_SETTINGS)).toBe('Smart zone: [bar:50.0:16] 50k/100k (50%)');
    });

    it('accepts a k-suffixed limit from metadata', () => {
        const context: RenderContext = {
            data: { model: { id: 'claude-3-5-sonnet-20241022' } },
            tokenMetrics: { ...emptyTokenMetrics, contextLength: 50000 }
        };
        const widget = new ContextLimitBarWidget();

        expect(widget.render({
            id: 'ctx',
            type: 'context-limit-bar',
            metadata: { limit: '130k' }
        }, context, DEFAULT_SETTINGS)).toBe('Smart zone: [bar:38.5:16] 50k/130k (38%)');
    });

    it('falls back to the default limit when metadata is invalid', () => {
        const context: RenderContext = {
            tokenMetrics: { ...emptyTokenMetrics, contextLength: 50000 }
        };
        const widget = new ContextLimitBarWidget();

        expect(widget.render({
            id: 'ctx',
            type: 'context-limit-bar',
            metadata: { limit: 'not-a-number' }
        }, context, DEFAULT_SETTINGS)).toBe('Smart zone: [bar:38.5:16] 50k/130k (38%)');
    });

    it('reports the actual percentage above 100% while clamping the bar fill', () => {
        const context: RenderContext = {
            data: {
                context_window: {
                    context_window_size: 200000,
                    current_usage: {
                        input_tokens: 200000,
                        output_tokens: 50000,
                        cache_creation_input_tokens: 0,
                        cache_read_input_tokens: 0
                    }
                }
            }
        };
        const widget = new ContextLimitBarWidget();

        // 200k / 130k = 154%, bar fill clamped to 100
        expect(widget.render({ id: 'ctx', type: 'context-limit-bar' }, context, DEFAULT_SETTINGS)).toBe('Smart zone: [bar:100.0:16] 200k/130k (154%)');
    });

    it('supports raw mode without the context label', () => {
        const context: RenderContext = {
            data: {
                context_window: {
                    context_window_size: 200000,
                    current_usage: {
                        input_tokens: 5000,
                        output_tokens: 5000,
                        cache_creation_input_tokens: 0,
                        cache_read_input_tokens: 0
                    }
                }
            }
        };
        const widget = new ContextLimitBarWidget();

        expect(widget.render({ id: 'ctx', type: 'context-limit-bar', rawValue: true }, context, DEFAULT_SETTINGS)).toBe('[bar:3.8:16] 5k/130k (4%)');
    });

    it('renders the long progress bar mode when configured', () => {
        const context: RenderContext = {
            tokenMetrics: { ...emptyTokenMetrics, contextLength: 50000 }
        };
        const widget = new ContextLimitBarWidget();

        expect(widget.render({
            id: 'ctx',
            type: 'context-limit-bar',
            metadata: { display: 'progress' }
        }, context, DEFAULT_SETTINGS)).toBe('Smart zone: [bar:38.5:32] 50k/130k (38%)');
    });

    it('renders a preview using the configured limit', () => {
        const widget = new ContextLimitBarWidget();

        expect(widget.render({ id: 'ctx', type: 'context-limit-bar' }, { isPreview: true }, DEFAULT_SETTINGS)).toBe('Smart zone: [bar:38.5:16] 50k/130k (38%)');
    });

    it('cycles display modes in the expected order', () => {
        const widget = new ContextLimitBarWidget();
        const base: WidgetItem = { id: 'ctx', type: 'context-limit-bar' };

        const first = widget.handleEditorAction('toggle-progress', base);
        const second = widget.handleEditorAction('toggle-progress', first ?? base);
        const third = widget.handleEditorAction('toggle-progress', second ?? base);
        const fourth = widget.handleEditorAction('toggle-progress', third ?? base);

        expect(first?.metadata?.display).toBe('progress');
        expect(second?.metadata?.display).toBe('slider');
        expect(third?.metadata?.display).toBe('slider-only');
        expect(fourth?.metadata?.display).toBe('progress-short');
    });

    it('returns null for the edit-limit action so the editor opens', () => {
        const widget = new ContextLimitBarWidget();
        const base: WidgetItem = { id: 'ctx', type: 'context-limit-bar' };

        expect(widget.handleEditorAction('edit-limit', base)).toBeNull();
    });
});
