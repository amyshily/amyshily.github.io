/* ============================================================
   Scrapbook page flip — open-book turn
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const book = document.getElementById('scrapbook-book');
  const pages = book ? Array.from(book.querySelectorAll('.scrapbook-page')) : [];
  const prevBtn = document.getElementById('scrapbook-prev');
  const nextBtn = document.getElementById('scrapbook-next');
  const dotsContainer = document.getElementById('scrapbook-dots');

  if (!book || !pages.length) {
    return;
  }

  const FLIP_MS = 650;
  let current = 0;
  let isAnimating = false;
  const maxIndex = pages.length;

  const setZIndexes = () => {
    pages.forEach((page, index) => {
      const flipped = page.classList.contains('flipped');
      // Turning page gets priority via CSS; keep stacks ordered otherwise.
      page.style.zIndex = String(flipped ? index + 1 : pages.length - index);
      page.classList.toggle('is-top', index === current);
    });
  };

  const updateChrome = () => {
    const closedStart = current === 0;
    const closedEnd = current === maxIndex;
    book.classList.toggle('is-closed-start', closedStart);
    book.classList.toggle('is-closed-end', closedEnd);
    book.classList.toggle('is-inside-cover', current === 1);
    book.style.setProperty(
      '--book-shift',
      closedStart ? '-25%' : closedEnd ? '25%' : '0%'
    );

    if (prevBtn) prevBtn.disabled = current === 0 || isAnimating;
    if (nextBtn) nextBtn.disabled = current === maxIndex || isAnimating;
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.scrapbook-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === current);
        dot.setAttribute('aria-selected', String(index === current));
      });
    }
  };

  const turnOne = (fromIndex, forward) =>
    new Promise((resolve) => {
      const page = pages[fromIndex];
      if (!page) {
        resolve();
        return;
      }

      // Keep shift + flip in sync (same CSS duration) for a clean open/close.
      if (forward && fromIndex === 0) {
        book.classList.remove('is-closed-start');
        book.style.setProperty('--book-shift', '0%');
      }
      if (!forward && fromIndex === pages.length - 1) {
        book.classList.remove('is-closed-end');
        book.style.setProperty('--book-shift', '0%');
      }

      page.classList.add('is-turning');
      page.style.zIndex = '60';

      requestAnimationFrame(() => {
        if (forward) {
          page.classList.add('flipped');
        } else {
          page.classList.remove('flipped');
        }
      });

      window.setTimeout(() => {
        page.classList.remove('is-turning');
        resolve();
      }, FLIP_MS);
    });

  const goTo = async (target) => {
    const clamped = Math.max(0, Math.min(maxIndex, target));
    if (clamped === current || isAnimating) return;

    isAnimating = true;
    updateChrome();

    if (clamped > current) {
      for (let i = current; i < clamped; i += 1) {
        await turnOne(i, true);
        current = i + 1;
        setZIndexes();
        updateChrome();
      }
    } else {
      for (let i = current - 1; i >= clamped; i -= 1) {
        await turnOne(i, false);
        current = i;
        setZIndexes();
        updateChrome();
      }
    }

    isAnimating = false;
    setZIndexes();
    updateChrome();
  };

  if (dotsContainer) {
    for (let i = 0; i <= maxIndex; i += 1) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'scrapbook-dot';
      dot.setAttribute('role', 'tab');
      let label = `Page ${i + 1}`;
      if (i === 0) label = 'Front cover';
      if (i === maxIndex) label = 'Back cover';
      dot.setAttribute('aria-label', label);
      dot.addEventListener('click', (event) => {
        event.stopPropagation();
        goTo(i);
      });
      dotsContainer.appendChild(dot);
    }
  }

  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));

  book.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) return;
    const rect = book.getBoundingClientRect();
    const clickX = event.clientX - rect.left;

    if (current === 0 || current === maxIndex) {
      goTo(current === 0 ? current + 1 : current - 1);
      return;
    }

    if (clickX > rect.width * 0.5) {
      goTo(current + 1);
    } else {
      goTo(current - 1);
    }
  });

  let touchStartX = null;
  book.addEventListener(
    'touchstart',
    (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    },
    { passive: true }
  );
  book.addEventListener(
    'touchend',
    (event) => {
      if (touchStartX == null) return;
      const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      if (Math.abs(delta) < 40) return;
      if (delta < 0) goTo(current + 1);
      else goTo(current - 1);
      touchStartX = null;
    },
    { passive: true }
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(current + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(current - 1);
    }
  });

  setZIndexes();
  updateChrome();
});
