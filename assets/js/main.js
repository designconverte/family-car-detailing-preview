/* Family Car Detailing — comportamento do site.
   Regra do styleguide: o conteúdo nunca depende da animação. Sem GSAP ou com
   prefers-reduced-motion, tudo aparece no estado final e continua utilizável. */
(() => {
  'use strict';

  const d = document;
  const $ = (sel, root = d) => root.querySelector(sel);
  const $$ = (sel, root = d) => Array.from(root.querySelectorAll(sel));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const canAnimate = Boolean(gsap && ScrollTrigger) && !reduced;
  let lenis = null; // rolagem suave; criada mais abaixo, só quando há animação
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- revelar ao entrar na tela ---------- */
  const revealTargets = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    // a "passada" começa recortada a 1px, então a proporção visível nunca chega a 15%
    const ioWipe = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        ioWipe.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -18% 0px' });
    revealTargets.forEach((el) => (el.dataset.reveal === 'wipe' ? ioWipe : io).observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- antes e depois ---------- */
  $$('.fcd-ba').forEach((ba) => {
    const range = $('.fcd-ba__range', ba);
    if (!range) return;
    const set = () => ba.style.setProperty('--pos', `${range.value}%`);
    range.addEventListener('input', set);
    set();
  });

  /* ---------- navegação: seção atual + barra fixa mobile ---------- */
  const navLinks = $$('.fcd-nav a[href^="#"]');
  if ('IntersectionObserver' in window && navLinks.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => {
          if (a.getAttribute('href') === `#${entry.target.id}`) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('main > section[id]').forEach((section) => spy.observe(section));
  }

  // barra fixa do celular: aparece assim que a primeira dobra passa (não espera o hero inteiro sair)
  const callbar = $('[data-callbar]');
  if (callbar) {
    let ticking = false;
    const update = () => {
      ticking = false;
      callbar.classList.toggle('is-on', window.scrollY > window.innerHeight * 0.6);
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- vídeo do hero: só toca quando faz sentido ---------- */
  const heroVideo = $('[data-hero-video]');
  const heroToggle = $('[data-hero-toggle]');
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  if (heroVideo && !reduced && !saveData) {
    const list = window.matchMedia('(max-width: 760px)').matches ? heroVideo.dataset.srcNarrow : heroVideo.dataset.srcWide;
    list.split(',').forEach((entry) => {
      const [src, type] = entry.split('|');
      const source = d.createElement('source');
      source.src = src;
      source.type = type;
      heroVideo.appendChild(source);
    });
    let userPaused = false;
    const setToggle = (playing) => {
      if (!heroToggle) return;
      heroToggle.setAttribute('aria-pressed', String(!playing));
      heroToggle.setAttribute('aria-label', playing ? 'Pause background video' : 'Play background video');
      $('[data-icon="pause"]', heroToggle).hidden = !playing;
      $('[data-icon="play"]', heroToggle).hidden = playing;
    };
    const play = () => {
      const attempt = heroVideo.play();
      if (attempt && attempt.catch) attempt.catch(() => setToggle(false)); // autoplay bloqueado: fica o pôster
    };
    heroVideo.addEventListener('playing', () => { if (heroToggle) heroToggle.hidden = false; setToggle(true); });
    heroVideo.addEventListener('pause', () => setToggle(false));
    heroVideo.load();
    // fora da tela o vídeo para (economiza bateria e processamento)
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !userPaused) play();
        else if (!entry.isIntersecting) heroVideo.pause();
      }, { threshold: 0.1 }).observe(heroVideo);
    } else {
      play();
    }
    if (heroToggle) {
      heroToggle.addEventListener('click', () => {
        userPaused = !heroVideo.paused;
        if (userPaused) heroVideo.pause();
        else play();
      });
    }
  }

  /* ---------- menu overlay (NAV-001) ---------- */
  const menu = $('#menu');
  const menuBtn = $('.fcd-menu-btn');
  if (menu && menuBtn) {
    const layers = $$('.fcd-menu__layer', menu);
    const panel = $('.fcd-menu__panel', menu);
    const labels = $$('.fcd-menu__item a', menu);
    const closeBtn = $('[data-menu-close]', menu);
    const root = d.documentElement;
    let isOpen = false;
    let prevOverflow = '';
    let openTl = null;
    let closeTl = null;

    if (canAnimate) gsap.set([...layers, panel], { xPercent: 100, x: 0 });
    else menu.classList.add('is-instant');

    const finishClose = () => {
      menu.classList.remove('is-busy');
      menu.inert = true;
    };

    const open = () => {
      if (isOpen) return;
      isOpen = true;
      menu.inert = false;
      menu.classList.add('is-open', 'is-busy');
      menuBtn.setAttribute('aria-expanded', 'true');
      prevOverflow = root.style.overflow;
      root.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      if (canAnimate) {
        if (closeTl) closeTl.kill();
        // entrada: cortina, painel logo atrás, itens a 15% da duração do painel
        openTl = gsap.timeline();
        layers.forEach((el, i) => openTl.to(el, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, i * 0.07));
        const panelAt = layers.length * 0.07;
        openTl.to(panel, { xPercent: 0, duration: 0.65, ease: 'power4.out' }, panelAt);
        openTl.fromTo(labels, { yPercent: 140, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 0.7, ease: 'power4.out', stagger: 0.07 }, panelAt + 0.65 * 0.15);
      }
      closeBtn.focus({ preventScroll: true });
    };

    const close = (returnFocus = true) => {
      if (!isOpen) return;
      isOpen = false;
      menu.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
      root.style.overflow = prevOverflow;
      if (lenis) lenis.start();
      if (canAnimate) {
        if (openTl) openTl.kill();
        // saída própria (não é reverse): o painel sai no primeiro frame
        closeTl = gsap.timeline({ onComplete: finishClose });
        closeTl.to(panel, { xPercent: 100, duration: 0.4, ease: 'power3.in' }, 0);
        layers.slice().reverse().forEach((el, i) => closeTl.to(el, { xPercent: 100, duration: 0.4, ease: 'power3.in' }, 0.05 + i * 0.05));
      } else {
        finishClose();
      }
      if (returnFocus) menuBtn.focus({ preventScroll: true });
    };

    menuBtn.addEventListener('click', () => (isOpen ? close() : open()));
    closeBtn.addEventListener('click', () => close());
    $$('a', menu).forEach((a) => a.addEventListener('click', () => close(false)));
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { close(); return; }
      if (event.key !== 'Tab') return;
      const focusables = $$('a[href], button:not([disabled])', menu);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && d.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && d.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    window.matchMedia('(min-width: 961px)').addEventListener('change', (mq) => { if (mq.matches) close(false); });
  }

  /* ---------- detalhes dos serviços: <dialog> nativo (Esc, foco e fundo inerte vêm do navegador) ---------- */
  const modalRoot = d.documentElement;
  let modalOpener = null;
  let modalLeaving = false; // fechou por um link que leva a outra seção: não devolver o foco ao cartão
  let modalPrevOverflow = '';
  const releaseModal = () => {
    modalRoot.style.overflow = modalPrevOverflow;
    if (lenis) lenis.start();
  };
  const closeModal = (dialog) => {
    if (!dialog.open) return;
    releaseModal(); // antes do close: o link "Book now" do modal precisa da rolagem destravada
    dialog.close();
  };
  $$('dialog.fcd-modal').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      releaseModal();
      // devolver o foco ao cartão dispararia o foco do trilho e puxaria a página de volta aos serviços
      if (modalOpener && !modalLeaving) modalOpener.focus({ preventScroll: true });
      modalOpener = null;
      modalLeaving = false;
    });
    // clique no fundo escuro fecha
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeModal(dialog); });
    $$('[data-modal-close]', dialog).forEach((el) => el.addEventListener('click', () => {
      modalLeaving = el.tagName === 'A';
      closeModal(dialog);
    }));
  });
  $$('[data-modal-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dialog = d.getElementById(btn.dataset.modalOpen);
      if (!dialog || typeof dialog.showModal !== 'function') return;
      modalOpener = btn;
      modalPrevOverflow = modalRoot.style.overflow;
      modalRoot.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      dialog.showModal();
      const box = $('.fcd-modal__box', dialog);
      if (box) box.scrollTop = 0;
    });
  });

  /* ---------- borda de luz (EFFECT-001): duas variáveis, 1 escrita por frame ---------- */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
    $$('[data-glow]').forEach((card) => {
      let frame = 0;
      let point = null;
      const write = () => {
        frame = 0;
        const rect = card.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = point.x - rect.left - cx;
        const dy = point.y - rect.top - cy;
        const kx = dx === 0 ? Infinity : cx / Math.abs(dx);
        const ky = dy === 0 ? Infinity : cy / Math.abs(dy);
        const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        card.style.setProperty('--edge', Math.min(Math.max((edge - 0.25) / 0.5, 0), 1).toFixed(3));
        card.style.setProperty('--angle', `${angle.toFixed(1)}deg`);
      };
      card.addEventListener('pointermove', (event) => {
        point = { x: event.clientX, y: event.clientY };
        if (!frame) frame = requestAnimationFrame(write);
      });
      card.addEventListener('pointerleave', () => {
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        card.style.removeProperty('--edge');
      });
    });
  }

  /* ---------- agendamento (SCHED-002): pedido de horário, sem vagas inventadas ---------- */
  const bookForm = $('#book-form');
  const sum = (key) => $(`[data-sum="${key}"]`, bookForm);
  const setSum = (key, value, emptyText) => {
    const el = sum(key);
    if (!el) return;
    el.textContent = value || emptyText;
    el.toggleAttribute('data-empty', !value);
  };
  let chosenDay = null;

  if (bookForm) {
    const daysBox = $('[data-days]', bookForm);
    const hint = $('[data-book-hint]', bookForm);
    const dayButtons = [];
    const today = new Date();

    for (let i = 1; i <= 14; i += 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const btn = d.createElement('button');
      btn.type = 'button';
      btn.className = 'fcd-day';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.tabIndex = i === 1 ? 0 : -1;
      btn.dataset.iso = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
      btn.dataset.label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      btn.setAttribute('aria-label', date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
      const weekday = d.createElement('span');
      weekday.textContent = date.toLocaleDateString('en-US', { weekday: 'short' });
      const num = d.createElement('b');
      num.textContent = String(date.getDate());
      const month = d.createElement('span');
      month.textContent = date.toLocaleDateString('en-US', { month: 'short' });
      btn.append(weekday, num, month);
      daysBox.appendChild(btn);
      dayButtons.push(btn);
    }

    const updateHint = () => {
      const win = bookForm.elements.window.value;
      hint.textContent = chosenDay && win
        ? 'We confirm your price and pickup time by text before anything is final.'
        : 'Pick a day and a drop-off time to continue.';
      hint.classList.remove('fcd-msg--error');
    };

    const pickDay = (btn, focus) => {
      dayButtons.forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      chosenDay = btn;
      setSum('day', btn.dataset.label, 'Pick a day');
      if (focus) btn.focus();
      updateHint();
    };

    daysBox.addEventListener('click', (event) => {
      const btn = event.target.closest('.fcd-day');
      if (btn) pickDay(btn, false);
    });
    daysBox.addEventListener('keydown', (event) => {
      const index = dayButtons.indexOf(d.activeElement);
      if (index < 0) return;
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      pickDay(dayButtons[(index + step + dayButtons.length) % dayButtons.length], true);
    });

    // estimativa: os preços vêm dos data-price do HTML, nunca daqui
    const refresh = () => {
      const vehicle = $('input[name="vehicle"]:checked', bookForm);
      const addons = $$('input[name="addons"]:checked', bookForm);
      const total = Number(vehicle.dataset.price) + addons.reduce((acc, el) => acc + Number(el.dataset.price || 0), 0);
      const needsQuote = addons.some((el) => 'quote' in el.dataset);
      setSum('vehicle', vehicle.value, 'Pick a vehicle');
      setSum('addons', addons.map((el) => el.value).join(', '), 'None');
      setSum('price', `${'from' in vehicle.dataset ? 'From ' : ''}$${total}${needsQuote ? ' + polish quote' : ''}`, '');
    };

    bookForm.addEventListener('change', (event) => {
      const { name, value } = event.target;
      if (name === 'vehicle' || name === 'addons') refresh();
      if (name === 'window') { setSum('window', value, 'Pick a time'); updateHint(); }
    });

    // "Book" na tabela de preços já marca o veículo ou o adicional
    $$('[data-book-vehicle], [data-book-addon]').forEach((link) => {
      link.addEventListener('click', () => {
        const value = link.dataset.bookVehicle || link.dataset.bookAddon;
        const input = $$('input[name="vehicle"], input[name="addons"]', bookForm).find((el) => el.value === value);
        if (input) { input.checked = true; refresh(); }
      });
    });
    refresh();
  }

  /* ---------- formulários: validar ao sair do campo, erro ao lado, envio honesto ---------- */
  const phoneOk = (value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  };
  const fieldOk = (input) => {
    const value = input.value.trim();
    if (input.required && value === '') return false;
    if (value === '') return true;
    if (input.type === 'tel') return phoneOk(value);
    return input.checkValidity();
  };
  const checkField = (input) => {
    const ok = fieldOk(input);
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    const msg = d.getElementById(`${input.id}-msg`);
    if (msg) msg.hidden = ok;
    return ok;
  };
  const icon = (id) => {
    const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const use = d.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#${id}`);
    svg.appendChild(use);
    return svg;
  };
  const say = (form, kind, text) => {
    const box = $('[data-form-status]', form);
    if (!box) return;
    box.className = `fcd-msg fcd-msg--${kind}${box.classList.contains('fcd-form__full') ? ' fcd-form__full' : ''}`;
    const span = d.createElement('span');
    span.textContent = text;
    box.replaceChildren(icon(kind === 'success' ? 'i-check' : 'i-alert'), span);
    box.hidden = false;
    box.focus({ preventScroll: true });
  };

  $$('form[data-form]').forEach((form) => {
    const fields = $$('.fcd-input, .fcd-textarea', form).filter((el) => el.id);
    fields.forEach((input) => {
      input.addEventListener('blur', () => checkField(input));
      input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') checkField(input); });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const invalid = fields.filter((input) => !checkField(input));
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.company) return; // honeypot

      if (form.dataset.form === 'booking') {
        if (!chosenDay || !data.window) {
          const hint = $('[data-book-hint]', form);
          hint.textContent = 'Pick a day and a drop-off time first.';
          hint.classList.add('fcd-msg--error');
          (chosenDay ? $('input[name="window"]', form) : $('.fcd-day[tabindex="0"]', form)).focus();
          return;
        }
        data.day = chosenDay.dataset.iso;
        data.addons = new FormData(form).getAll('addons');
        data.estimate = $('[data-sum="price"]', form).textContent;
        data.timezone = 'America/New_York';
      }
      if (invalid.length) { invalid[0].focus(); return; }

      const endpoint = form.dataset.endpoint;
      if (!endpoint) {
        say(form, 'note', 'Preview mode: this request was not sent. Connect the form endpoint before launch.');
        return;
      }

      const button = $('button[type="submit"]', form);
      button.disabled = true;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ form: form.dataset.form, ...data }),
        });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        form.reset();
        say(form, 'success', 'Thanks. We have your request and will reply with your price and time.');
      } catch (error) {
        console.error('Failed to send form', { form: form.dataset.form, error });
        say(form, 'error', "Something went wrong and your request didn't send. Please try again or call us.");
      } finally {
        button.disabled = false;
      }
    });
  });

  /* ---------- movimento narrativo (GSAP) ---------- */
  if (!canAnimate) return;

  // a barra de endereço do celular muda a altura da tela ao rolar; sem isto os pins recalculam e pulam
  ScrollTrigger.config({ ignoreMobileResize: true });
  const mm = gsap.matchMedia();

  // Rolagem suave (Lenis): dá peso e inércia à roda do mouse e ao trackpad. No toque fica a
  // inércia nativa do celular; ali a suavidade vem do "scrub" com atraso nas animações abaixo.
  if (window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    // âncoras (#services, #book...) passam pela mesma rolagem suave
    d.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.defaultPrevented) return;
      const target = link.getAttribute('href').length > 1 ? $(link.getAttribute('href')) : null;
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: -($('.fcd-header').offsetHeight + 16) });
      history.pushState(null, '', link.getAttribute('href'));
    });
  }
  // quanto (em segundos) a animação leva para alcançar a rolagem: é o que tira o aspecto "seco"
  const SCRUB = 0.9;

  // hero: a foto assenta devagar enquanto a página rola (parallax curto, só desktop)
  mm.add('(min-width: 761px)', () => {
    const media = $('.fcd-hero__media');
    if (!media) return;
    // o vídeo vem de 832 px: pouca ampliação extra para não amolecer ainda mais
    gsap.fromTo(media, { scale: 1.05, yPercent: -2 }, {
      yPercent: 2, ease: 'none',
      scrollTrigger: { trigger: '.fcd-hero', start: 'top top', end: 'bottom top', scrub: SCRUB },
    });
  });

  // ORDEM IMPORTA: cada pin empurra o que vem depois. Os ScrollTriggers são criados na ordem
  // em que as seções aparecem na página (serviços → manifesto → processo); fora de ordem, o
  // manifesto fixa cedo demais e cobre a seção anterior.
  // serviços (SB-001): a seção fixa e os cartões correm na horizontal; fora do desktop é grade
  const rail = $('[data-rail]');
  if (rail) {
    const track = $('[data-rail-track]', rail);
    const cards = $$('.fcd-svc', track);
    const fill = $('.fcd-rail__progress i', rail);
    const count = $('[data-rail-count]', rail);
    // no celular também: a rolagem vertical move os cartões (sem arrasto lateral). Tela baixa demais
    // para o cartão caber inteiro → fica a grade empilhada.
    mm.add('(min-width: 961px), (max-width: 960px)', () => {
      rail.classList.add('is-rail');
      const headerH = () => $('.fcd-header').offsetHeight + (window.innerWidth > 960 ? 20 : 12);
      // O que fixa, em ordem de preferência: título + cartões; se não couber na tela, só os cartões;
      // se nem isso couber, fica a grade empilhada. A barra fixa do celular sai de cena enquanto os
      // cartões correm (cada cartão já tem o seu "Book").
      const callbarEl = $('[data-callbar]');
      const wrap = rail.closest('[data-railpin]');
      // a barra fixa do celular fica visível sobre o trilho; só sai de cena se for o único jeito
      // de os cartões caberem (celular baixo)
      const barH = callbarEl && getComputedStyle(callbarEl).display !== 'none' ? callbarEl.offsetHeight : 0;
      const full = window.innerHeight - headerH() - 8;
      let avail = full - barH;
      let hideBar = false;
      let pinEl = rail;
      if (wrap) {
        wrap.classList.add('is-pinhead');
        if (wrap.offsetHeight <= avail) pinEl = wrap;
        else wrap.classList.remove('is-pinhead');
      }
      if (pinEl.offsetHeight > avail && barH && pinEl.offsetHeight <= full) {
        hideBar = true;
        avail = full;
      }
      if (pinEl.offsetHeight > avail) {
        rail.classList.remove('is-rail');
        if (wrap) wrap.classList.remove('is-pinhead');
        return undefined;
      }
      // sobra de tela: os cartões crescem um pouco em vez de deixar um vazio embaixo
      const spare = Math.min(avail - pinEl.offsetHeight - 16, 160);
      if (spare > 0) rail.style.setProperty('--card-h', `${cards[0].offsetHeight + spare}px`);
      const distance = () => Math.max(track.scrollWidth - rail.clientWidth, 0);
      const pad = (n) => String(n).padStart(2, '0');
      const tween = gsap.to(track, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: {
          trigger: pinEl, start: () => `top ${headerH()}px`, end: () => `+=${distance()}`,
          pin: true, scrub: SCRUB, anticipatePin: 1, invalidateOnRefresh: true,
          onToggle: (self) => { if (callbarEl && hideBar) callbarEl.classList.toggle('is-away', self.isActive); },
          onUpdate: (self) => {
            gsap.set(fill, { scaleX: self.progress });
            count.textContent = `${pad(Math.min(cards.length, 1 + Math.round(self.progress * (cards.length - 1))))} / ${pad(cards.length)}`;
          },
        },
      });
      // Tab num cartão fora da tela: leva a rolagem até ele
      const onFocus = (event) => {
        const card = event.target.closest('.fcd-svc');
        const st = tween.scrollTrigger;
        if (!card || !st || !distance()) return;
        const ratio = Math.min(card.offsetLeft / distance(), 1);
        const y = st.start + ratio * (st.end - st.start);
        if (lenis) lenis.scrollTo(y, { immediate: true });
        else window.scrollTo({ top: y });
      };
      track.addEventListener('focusin', onFocus);
      return () => {
        track.removeEventListener('focusin', onFocus);
        rail.classList.remove('is-rail');
        rail.style.removeProperty('--card-h');
        if (wrap) wrap.classList.remove('is-pinhead');
        if (callbarEl) callbarEl.classList.remove('is-away');
        gsap.set(track, { clearProps: 'transform' });
      };
    });
  }

  // manifesto (CONTENT-001): a frase já está legível a 40% e ganha força palavra a palavra
  const manifesto = $('[data-manifesto]');
  if (manifesto) {
    const text = manifesto.textContent.trim();
    const words = text.split(/\s+/);
    const hlCount = (manifesto.dataset.hl || '').trim().split(/\s+/).filter(Boolean).length;
    const sr = d.createElement('span');
    sr.className = 'fcd-sr';
    sr.textContent = text;
    const visual = d.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    words.forEach((word, i) => {
      const unit = d.createElement('span');
      unit.className = i >= words.length - hlCount ? 'u hl' : 'u';
      unit.textContent = word;
      visual.append(unit, ' ');
    });
    manifesto.replaceChildren(sr, visual);
    const units = $$('.u', manifesto);

    mm.add({ desktop: '(min-width: 761px)', mobile: '(max-width: 760px)' }, (context) => {
      gsap.set(units, { opacity: 0.4 });
      gsap.to(units, {
        opacity: 1, ease: 'none', stagger: 0.5,
        scrollTrigger: {
          trigger: '.fcd-manifesto', start: 'top top',
          end: context.conditions.desktop ? '+=80%' : '+=60%',
          pin: true, scrub: SCRUB, invalidateOnRefresh: true,
        },
      });
    });
  }

  // processo (CARDS-001): o pin é CSS sticky; o GSAP só dá a profundidade da pilha
  const layers = $$('.fcd-layer');
  if (layers.length > 1) {
    mm.add({ desktop: '(min-width: 861px)', mobile: '(max-width: 860px)' }, (context) => {
      const itemScale = context.conditions.desktop ? 0.035 : 0.02;
      const topOf = (el) => parseFloat(getComputedStyle(el).top) || 0;
      const last = layers[layers.length - 1];
      layers.slice(0, -1).forEach((layer, i) => {
        const depth = layers.length - 1 - i;
        gsap.to($('.fcd-layer__inner', layer), {
          scale: 1 - depth * itemScale, ease: 'none',
          scrollTrigger: {
            trigger: layer, start: () => `top ${topOf(layer)}px`,
            endTrigger: last, end: () => `top ${topOf(last)}px`,
            scrub: 0.5, invalidateOnRefresh: true,
          },
        });
      });
    });
  }

  ScrollTrigger.sort();
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => ScrollTrigger.refresh());
})();
