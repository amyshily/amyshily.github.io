/* ============================================================
   Scrapbook page flip — open-book turn (desktop)
   Single-page faces on narrow screens so collages stay readable
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
  const PASS_MS = 280;
  const SINGLE_MQ = window.matchMedia('(max-width: 900px)');

  const faces = [];
  pages.forEach((page, pageIndex) => {
    faces.push({ pageIndex, side: 'front' });
    const back = page.querySelector('.page-back');
    if (!back) return;
    const meaningful = back.querySelector('img, .bookplate, .blank-cover, .blank-end');
    if (meaningful) {
      faces.push({ pageIndex, side: 'back' });
    }
  });

  let singlePage = SINGLE_MQ.matches;
  let current = 0;
  let isAnimating = false;

  const maxIndex = () => (singlePage ? faces.length - 1 : pages.length);

  const faceToSheet = (faceIndex) => {
    const face = faces[faceIndex];
    if (!face) return 0;
    return face.side === 'back' ? face.pageIndex + 1 : face.pageIndex;
  };

  const sheetToFace = (sheetIndex) => {
    if (sheetIndex >= pages.length) {
      return faces.length - 1;
    }
    const idx = faces.findIndex(
      (face) => face.pageIndex === sheetIndex && face.side === 'front'
    );
    return idx === -1 ? 0 : idx;
  };

  const setZIndexes = () => {
    if (singlePage) {
      const face = faces[current] || faces[0];
      pages.forEach((page, index) => {
        const flipped =
          index < face.pageIndex || (index === face.pageIndex && face.side === 'back');
        page.classList.toggle('flipped', flipped);
        page.classList.toggle('is-passed', index < face.pageIndex);
        page.classList.toggle('is-top', index === face.pageIndex);
        page.style.zIndex = String(
          index === face.pageIndex ? pages.length + 2 : pages.length - index
        );
      });
      return;
    }

    pages.forEach((page, index) => {
      const flipped = page.classList.contains('flipped');
      page.classList.remove('is-passed');
      page.style.zIndex = String(flipped ? index + 1 : pages.length - index);
      page.classList.toggle('is-top', index === current);
    });
  };

  const rebuildDots = () => {
    if (!dotsContainer) return;
    dotsContainer.replaceChildren();
    const last = maxIndex();
    for (let i = 0; i <= last; i += 1) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'scrapbook-dot';
      dot.setAttribute('role', 'tab');
      let label = `Page ${i + 1}`;
      if (i === 0) label = 'Front cover';
      if (i === last) label = 'Back cover';
      dot.setAttribute('aria-label', label);
      dot.addEventListener('click', (event) => {
        event.stopPropagation();
        goTo(i);
      });
      dotsContainer.appendChild(dot);
    }
  };

  const updateChrome = () => {
    const last = maxIndex();
    const closedStart = current === 0;
    const closedEnd = current === last;
    book.classList.toggle('is-single-page', singlePage);
    book.classList.toggle('is-closed-start', closedStart);
    book.classList.toggle('is-closed-end', closedEnd);
    book.classList.toggle('is-inside-cover', !singlePage && current === 1);
    if (singlePage) {
      book.style.setProperty('--book-shift', '0%');
    } else {
      book.style.setProperty(
        '--book-shift',
        closedStart ? '-25%' : closedEnd ? '25%' : '0%'
      );
    }

    if (prevBtn) prevBtn.disabled = current === 0 || isAnimating;
    if (nextBtn) nextBtn.disabled = current === last || isAnimating;
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

      if (!singlePage) {
        if (forward && fromIndex === 0) {
          book.classList.remove('is-closed-start');
          book.style.setProperty('--book-shift', '0%');
        }
        if (!forward && fromIndex === pages.length - 1) {
          book.classList.remove('is-closed-end');
          book.style.setProperty('--book-shift', '0%');
        }
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

  const turnFace = (fromIndex, toIndex) => {
    const fromFace = faces[fromIndex];
    const toFace = faces[toIndex];
    if (!fromFace || !toFace) {
      return Promise.resolve();
    }

    if (fromFace.pageIndex === toFace.pageIndex) {
      return turnOne(fromFace.pageIndex, toIndex > fromIndex);
    }

    return new Promise((resolve) => {
      const face = toFace;
      pages.forEach((page, index) => {
        const flipped =
          index < face.pageIndex || (index === face.pageIndex && face.side === 'back');
        page.classList.toggle('flipped', flipped);
        page.classList.toggle('is-passed', index < face.pageIndex);
        page.classList.toggle('is-top', index === face.pageIndex);
        page.style.zIndex = String(
          index === face.pageIndex ? pages.length + 2 : pages.length - index
        );
      });
      window.setTimeout(resolve, PASS_MS);
    });
  };

  const goTo = async (target) => {
    const last = maxIndex();
    const clamped = Math.max(0, Math.min(last, target));
    if (clamped === current || isAnimating) return;

    isAnimating = true;
    updateChrome();

    if (singlePage) {
      const step = clamped > current ? 1 : -1;
      while (current !== clamped) {
        await turnFace(current, current + step);
        current += step;
        setZIndexes();
        updateChrome();
      }
    } else if (clamped > current) {
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

  const applyMode = (nextSingle, remap) => {
    if (remap) {
      current = nextSingle ? sheetToFace(current) : faceToSheet(current);
    }
    singlePage = nextSingle;
    pages.forEach((page) => {
      page.classList.remove('is-turning');
      if (!singlePage) page.classList.remove('is-passed');
    });
    if (!singlePage) {
      pages.forEach((page, index) => {
        page.classList.toggle('flipped', index < current);
      });
    }
    rebuildDots();
    setZIndexes();
    updateChrome();
  };

  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));

  book.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) return;
    const rect = book.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const last = maxIndex();

    if (!singlePage && (current === 0 || current === last)) {
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

  const onModeChange = (event) => {
    if (event.matches === singlePage) return;
    isAnimating = false;
    applyMode(event.matches, true);
  };

  if (typeof SINGLE_MQ.addEventListener === 'function') {
    SINGLE_MQ.addEventListener('change', onModeChange);
  } else if (typeof SINGLE_MQ.addListener === 'function') {
    SINGLE_MQ.addListener(onModeChange);
  }

  applyMode(singlePage, false);
});
