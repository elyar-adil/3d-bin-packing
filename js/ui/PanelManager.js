/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil

    PanelManager — handles panel collapse/expand, drag-to-reorder, and resize.
    Responsibilities (Single Responsibility per method group):
      - Collapse: toggleCollapse()
      - Drag:     _initDrag() — drag panel headers to reorder within sidebar
      - Resize:   _initSidebarResize() — drag sidebar edge to change its width
                  _initPanelResize()   — drag panel bottom handle to change its height
*/

export class PanelManager {
    /**
     * @param {HTMLElement} container - The container element holding panel-cards.
     * @param {Object}      [opts]
     * @param {number}      [opts.minSidebarWidth=220]  - Min resize width (0 = no sidebar resize).
     * @param {number}      [opts.maxSidebarWidth=520]
     * @param {boolean}     [opts.enableDrag=true]      - Allow drag-to-reorder.
     * @param {boolean}     [opts.enableSidebarResize=true]
     */
    constructor(container, opts = {}) {
        this._sidebar = container;
        this._minW = opts.minSidebarWidth ?? 220;
        this._maxW = opts.maxSidebarWidth ?? 520;
        this._enableDrag          = opts.enableDrag          ?? true;
        this._enableSidebarResize = opts.enableSidebarResize ?? (this._minW > 0);

        if (this._enableSidebarResize) this._initSidebarResize();
        this._initPanels();
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Toggle a panel's collapsed state.
     * @param {HTMLElement} panelBody   - The collapsible body element.
     * @param {HTMLElement} [header]    - The header element (gets .collapsed class).
     */
    toggleCollapse(panelBody, header) {
        const isOpen = !panelBody.classList.contains('panel-collapsed');
        if (isOpen) {
            // Store current height for animation, then animate to 0
            panelBody.style.maxHeight = panelBody.scrollHeight + 'px';
            // Force reflow
            panelBody.offsetHeight; // eslint-disable-line
            panelBody.classList.add('panel-collapsed');
            panelBody.style.maxHeight = '0';
        } else {
            panelBody.classList.remove('panel-collapsed');
            panelBody.style.maxHeight = panelBody.scrollHeight + 'px';
            // After transition ends, let CSS handle auto sizing
            panelBody.addEventListener('transitionend', () => {
                if (!panelBody.classList.contains('panel-collapsed')) {
                    panelBody.style.maxHeight = '';
                }
            }, { once: true });
        }
        if (header) header.classList.toggle('collapsed', isOpen);
    }

    // ─── Init ────────────────────────────────────────────────────────────────

    /** Find and initialise all .panel-card elements inside the sidebar. */
    _initPanels() {
        // Only process direct-child panel-cards (avoid recursion into nested panels)
        const cards = [...this._sidebar.children].filter(el => el.classList.contains('panel-card'));
        cards.forEach(card => {
            this._initCollapse(card);
            if (this._enableDrag) this._initDragHandle(card);
            this._initPanelResize(card);
        });
    }

    // ─── Collapse ────────────────────────────────────────────────────────────

    _initCollapse(card) {
        const header = card.querySelector('.panel-header');
        const body   = card.querySelector('.panel-body');
        if (!header || !body) return;

        // Replace existing onclick to use animation-aware toggle
        header.onclick = null;
        header.addEventListener('click', e => {
            // Don't collapse when clicking resize handle or drag handle buttons
            if (e.target.closest('.panel-resize-handle') || e.target.closest('.drag-ignore')) return;
            this.toggleCollapse(body, header);
        });
    }

    // ─── Drag-to-reorder ─────────────────────────────────────────────────────

    _initDragHandle(card) {
        const header = card.querySelector('.panel-header');
        if (!header) return;

        // Add drag handle icon
        const grip = document.createElement('span');
        grip.className    = 'panel-drag-grip';
        grip.title        = '拖动排序';
        grip.innerHTML    = '&#8942;'; // ⋮
        grip.setAttribute('draggable', 'false');
        header.prepend(grip);

        card.setAttribute('draggable', 'true');
        card.dataset.draggable = '1';

        card.addEventListener('dragstart', e => this._onDragStart(e, card));
        card.addEventListener('dragend',   e => this._onDragEnd(e, card));
        card.addEventListener('dragover',  e => this._onDragOver(e, card));
        card.addEventListener('drop',      e => this._onDrop(e, card));
        card.addEventListener('dragleave', e => card.classList.remove('drag-over'));
    }

    _onDragStart(e, card) {
        this._dragging = card;
        card.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
    }

    _onDragEnd(e, card) {
        card.classList.remove('is-dragging');
        this._sidebar.querySelectorAll('.panel-card').forEach(c => c.classList.remove('drag-over'));
        this._dragging = null;
    }

    _onDragOver(e, card) {
        if (!this._dragging || this._dragging === card) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this._sidebar.querySelectorAll('.panel-card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
    }

    _onDrop(e, card) {
        if (!this._dragging || this._dragging === card) return;
        e.preventDefault();
        card.classList.remove('drag-over');

        // Determine insertion position
        const dragRect = this._dragging.getBoundingClientRect();
        const dropRect = card.getBoundingClientRect();
        const insertBefore = e.clientY < dropRect.top + dropRect.height / 2;

        if (insertBefore) {
            this._sidebar.insertBefore(this._dragging, card);
        } else {
            this._sidebar.insertBefore(this._dragging, card.nextSibling);
        }
    }

    // ─── Panel body resize (height) ──────────────────────────────────────────

    _initPanelResize(card) {
        const body = card.querySelector('.panel-body');
        if (!body) return;

        const handle = document.createElement('div');
        handle.className = 'panel-resize-handle';
        handle.title     = '拖动调整高度';
        card.appendChild(handle);

        let startY = 0, startH = 0;

        const onMove = e => {
            const dy = (e.clientY || e.touches?.[0]?.clientY || 0) - startY;
            const newH = Math.max(40, startH + dy);
            body.style.maxHeight = newH + 'px';
            body.style.overflowY = 'auto';
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',  onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend',  onUp);
            document.body.style.userSelect = '';
            document.body.style.cursor     = '';
        };

        handle.addEventListener('mousedown', e => {
            if (body.classList.contains('panel-collapsed')) return;
            e.stopPropagation(); // don't trigger collapse
            startY = e.clientY;
            startH = body.offsetHeight;
            document.body.style.userSelect = 'none';
            document.body.style.cursor     = 'ns-resize';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });
    }

    // ─── Sidebar width resize ────────────────────────────────────────────────

    _initSidebarResize() {
        const handle = document.createElement('div');
        handle.id        = 'sidebar-resize-handle';
        handle.title     = '拖动调整侧栏宽度';
        this._sidebar.appendChild(handle);

        let startX = 0, startW = 0;

        const onMove = e => {
            const dx  = (e.clientX || e.touches?.[0]?.clientX || 0) - startX;
            const newW = Math.min(this._maxW, Math.max(this._minW, startW + dx));
            this._sidebar.style.width    = newW + 'px';
            this._sidebar.style.minWidth = newW + 'px';
            this._sidebar.style.maxWidth = newW + 'px';
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend',  onUp);
            document.body.style.userSelect = '';
            document.body.style.cursor     = '';
        };

        handle.addEventListener('mousedown', e => {
            e.preventDefault();
            startX = e.clientX;
            startW = this._sidebar.offsetWidth;
            document.body.style.userSelect = 'none';
            document.body.style.cursor     = 'ew-resize';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });

        handle.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            startW = this._sidebar.offsetWidth;
            document.addEventListener('touchmove', onMove, { passive: true });
            document.addEventListener('touchend',  onUp);
        }, { passive: true });
    }
}
