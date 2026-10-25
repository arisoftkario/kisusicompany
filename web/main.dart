import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:math' as math;

import 'package:web/web.dart' as web;

/// Numéro WhatsApp de KISUSI COMPANY (format international, sans "+").
const whatsappNumber = '243980957817';

/// Taux d'intérêt mensuel utilisé par le simulateur de crédit (0.015 = 1,5 %).
/// À ajuster selon les conditions réelles de l'entreprise.
const tauxMensuelCredit = 0.015;

/// Catalogue affiché sur le site. Pour ajouter un véhicule, ajoutez une
/// entrée ici et placez sa photo dans `web/images/`.
const vehicles = <Vehicle>[
  Vehicle(
    name: 'Toyota Tacoma 4x4',
    category: 'Pick-up',
    image: 'pickup.jpg',
    year: 2018,
    km: 68000,
    fuel: 'Essence',
    price: 24500,
  ),
  Vehicle(
    name: 'Toyota Camry',
    category: 'Berline',
    image: 'berline.jpg',
    year: 2019,
    km: 54000,
    fuel: 'Essence',
    price: 16800,
  ),
  Vehicle(
    name: 'Honda CR-V',
    category: 'SUV',
    image: 'suv.jpg',
    year: 2018,
    km: 72000,
    fuel: 'Essence',
    price: 15500,
  ),
  Vehicle(
    name: 'Nissan Juke',
    category: 'SUV',
    image: 'suv-compact.jpg',
    year: 2017,
    km: 61000,
    fuel: 'Essence',
    price: 9900,
  ),
  Vehicle(
    name: 'Ford Expedition',
    category: 'SUV',
    image: 'suv-grand.jpg',
    year: 2018,
    km: 80000,
    fuel: 'Essence',
    price: 29000,
    fromJapan: false,
  ),
  Vehicle(
    name: 'BMW Série 4 Coupé',
    category: 'Berline',
    image: 'coupe.jpg',
    year: 2017,
    km: 66000,
    fuel: 'Essence',
    price: 21500,
    fromJapan: false,
  ),
  Vehicle(
    name: 'KTM RC 390',
    category: 'Moto',
    image: 'moto-sport.jpg',
    year: 2020,
    km: 9000,
    fuel: 'Essence',
    price: 4200,
    fromJapan: false,
  ),
  Vehicle(
    name: 'Ducati SuperSport',
    category: 'Moto',
    image: 'moto-route.jpg',
    year: 2019,
    km: 12000,
    fuel: 'Essence',
    price: 9800,
    fromJapan: false,
  ),
  Vehicle(
    name: 'Moto Cruiser 250 cc',
    category: 'Moto',
    image: 'moto-cruiser.jpg',
    year: 2021,
    km: 6000,
    fuel: 'Essence',
    price: 2900,
  ),
];

class Vehicle {
  final String name;
  final String category;
  final String image;
  final int year;
  final int km;
  final String fuel;
  final int price;
  final bool cash;
  final bool credit;
  final bool fromJapan;

  const Vehicle({
    required this.name,
    required this.category,
    required this.image,
    required this.year,
    required this.km,
    required this.fuel,
    required this.price,
    this.cash = true,
    this.credit = true,
    this.fromJapan = true,
  });
}

String _currentFilter = 'Tous';
int _simMonths = 12;

void main() {
  web.document.documentElement!.classList.add('js');

  _setupHeader();
  _setupCatalog();
  _setupSimulator();
  _setupContactForm();
  _setupReveal();
  _setupInstall();

  web.document.querySelector('#year')!.textContent = '${DateTime.now().year}';
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

List<web.Element> _all(String selector) {
  final nodes = web.document.querySelectorAll(selector);
  return [for (var i = 0; i < nodes.length; i++) nodes.item(i) as web.Element];
}

void _on(web.EventTarget target, String type, void Function(web.Event) fn) =>
    target.addEventListener(type, fn.toJS);

/// Formate un nombre avec des espaces comme séparateurs : 15000 -> "15 000".
String _fmt(num value) {
  final digits = value.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

String _usd(num value) => '${_fmt(value)} \$';

String _whatsappLink(String message) =>
    'https://wa.me/$whatsappNumber?text=${Uri.encodeComponent(message)}';

String _escape(String s) => s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// ---------------------------------------------------------------------------
// En-tête & menu mobile
// ---------------------------------------------------------------------------

void _setupHeader() {
  final header = web.document.querySelector('#header')!;
  final burger = web.document.querySelector('#burger')!;
  final body = web.document.body!;
  final links = _all('.nav a[href^="#"]');
  final sections = _all('main section[id]');

  void onScroll() {
    final y = web.window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);

    // Lien actif selon la section visible.
    var current = '';
    for (final s in sections) {
      final top = (s as web.HTMLElement).offsetTop;
      if (y + 140 >= top) current = s.id;
    }
    for (final a in links) {
      a.classList.toggle('is-active', a.getAttribute('href') == '#$current');
    }
  }

  void closeMenu() {
    body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
  }

  _on(web.window, 'scroll', (_) => onScroll());
  onScroll();

  _on(burger, 'click', (_) {
    final open = body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', '$open');
  });
  for (final a in _all('.nav a')) {
    _on(a, 'click', (_) => closeMenu());
  }
  _on(web.window, 'resize', (_) {
    if (web.window.innerWidth > 960) closeMenu();
  });
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

void _setupCatalog() {
  final chips = _all('#filters .chip');
  for (final chip in chips) {
    _on(chip, 'click', (_) {
      _currentFilter = chip.getAttribute('data-filter') ?? 'Tous';
      for (final c in chips) {
        c.classList.toggle('is-active', c == chip);
      }
      _renderCatalog();
    });
  }
  _renderCatalog();
}

void _renderCatalog() {
  final container = web.document.querySelector('#catalog')!;
  final items = vehicles.where(
    (v) => _currentFilter == 'Tous' || v.category == _currentFilter,
  );

  final html = StringBuffer();
  var i = 0;
  for (final v in items) {
    final index = vehicles.indexOf(v);
    final message =
        'Bonjour KISUSI COMPANY, je suis intéressé(e) par le '
        'véhicule "${v.name}" (${v.year}) affiché à ${_usd(v.price)} '
        'sur votre site. Est-il toujours disponible ?';
    html.write('''
<article class="card" style="animation-delay:${i++ * 70}ms">
  <div class="card__media">
    <img src="images/${v.image}" alt="${_escape(v.name)}" loading="lazy">
    <span class="card__cat">${v.category}</span>
    ${v.fromJapan ? '<span class="card__origin"><svg class="flag" viewBox="0 0 30 20"><use href="#f-jp"/></svg>Import Japon</span>' : ''}
  </div>
  <div class="card__body">
    <div class="card__pay">
      ${v.cash ? '<span>Cash</span>' : ''}
      ${v.credit ? '<span class="is-credit">Crédit</span>' : ''}
    </div>
    <h3 class="card__title">${_escape(v.name)}</h3>
    <ul class="card__specs">
      <li><svg viewBox="0 0 24 24"><use href="#i-calendar"/></svg>${v.year}</li>
      <li><svg viewBox="0 0 24 24"><use href="#i-gauge"/></svg>${_fmt(v.km)} km</li>
      <li><svg viewBox="0 0 24 24"><use href="#i-fuel"/></svg>${v.fuel}</li>
    </ul>
    <div class="card__foot">
      <div class="card__price"><small>Prix</small><strong>${_usd(v.price)}</strong></div>
      <div class="card__actions">
        ${v.credit ? '<button class="icon-btn" data-simulate="$index" title="Simuler un crédit" aria-label="Simuler un crédit pour ${_escape(v.name)}"><svg viewBox="0 0 24 24"><use href="#i-calendar"/></svg></button>' : ''}
        <a class="icon-btn icon-btn--wa" href="${_whatsappLink(message)}" target="_blank" rel="noopener" title="Commander sur WhatsApp" aria-label="Commander ${_escape(v.name)} sur WhatsApp"><svg viewBox="0 0 24 24"><use href="#i-whatsapp"/></svg></a>
      </div>
    </div>
  </div>
</article>''');
  }
  container.innerHTML = html.toString().toJS;

  for (final btn in _all('#catalog [data-simulate]')) {
    _on(btn, 'click', (_) {
      final v = vehicles[int.parse(btn.getAttribute('data-simulate')!)];
      _selectVehicleForCredit(v);
    });
  }
}

// ---------------------------------------------------------------------------
// Simulateur de crédit
// ---------------------------------------------------------------------------

String? _simVehicleName;

web.HTMLInputElement get _priceInput =>
    web.document.querySelector('#sim-price') as web.HTMLInputElement;
web.HTMLInputElement get _downInput =>
    web.document.querySelector('#sim-down') as web.HTMLInputElement;

void _setupSimulator() {
  _on(_priceInput, 'input', (_) {
    _simVehicleName = null;
    _updateSimulator();
  });
  _on(_downInput, 'input', (_) => _updateSimulator());

  final durations = _all('#sim-durations button');
  for (final b in durations) {
    _on(b, 'click', (_) {
      _simMonths = int.parse(b.getAttribute('data-months')!);
      for (final d in durations) {
        d.classList.toggle('is-active', d == b);
      }
      _updateSimulator();
    });
  }
  _updateSimulator();
}

void _selectVehicleForCredit(Vehicle v) {
  _priceInput.value = '${v.price}';
  _simVehicleName = v.name;
  _updateSimulator();
  web.document
      .querySelector('#credit')!
      .scrollIntoView(
        web.ScrollIntoViewOptions(behavior: 'smooth', block: 'start'),
      );
}

void _updateSimulator() {
  final price = double.tryParse(_priceInput.value) ?? 0;
  final downPct = int.parse(_downInput.value);

  final min = double.parse(_downInput.min);
  final max = double.parse(_downInput.max);
  _downInput.style.setProperty(
    '--fill',
    '${(downPct - min) / (max - min) * 100}%',
  );
  web.document.querySelector('#sim-down-out')!.textContent = '$downPct %';

  final down = price * downPct / 100;
  final financed = price - down;
  final monthly = tauxMensuelCredit == 0
      ? financed / _simMonths
      : financed *
            tauxMensuelCredit /
            (1 - math.pow(1 + tauxMensuelCredit, -_simMonths));

  final valid = price > 0;
  web.document.querySelector('#sim-down-amount')!.textContent = valid
      ? _usd(down)
      : '—';
  web.document.querySelector('#sim-financed')!.textContent = valid
      ? _usd(financed)
      : '—';
  web.document.querySelector('#sim-monthly')!.textContent = valid
      ? '${_usd(monthly)} / mois'
      : '—';

  final vehicle = _simVehicleName != null
      ? ' pour le véhicule "$_simVehicleName"'
      : '';
  final message =
      'Bonjour KISUSI COMPANY, je souhaite une offre de crédit'
      '$vehicle.\n'
      '• Prix : ${_usd(price)}\n'
      '• Apport : $downPct % (${_usd(down)})\n'
      '• Durée : $_simMonths mois\n'
      '• Mensualité estimée : ${_usd(monthly)}';
  (web.document.querySelector('#sim-request') as web.HTMLAnchorElement).href =
      _whatsappLink(message);
}

// ---------------------------------------------------------------------------
// Formulaire de contact -> WhatsApp
// ---------------------------------------------------------------------------

void _setupContactForm() {
  final form = web.document.querySelector('#contact-form')!;
  final name = web.document.querySelector('#f-name') as web.HTMLInputElement;
  final phone = web.document.querySelector('#f-phone') as web.HTMLInputElement;
  final subject =
      web.document.querySelector('#f-subject') as web.HTMLSelectElement;
  final text =
      web.document.querySelector('#f-message') as web.HTMLTextAreaElement;
  final error = web.document.querySelector('#f-error') as web.HTMLElement;

  _on(form, 'submit', (event) {
    event.preventDefault();

    var ok = true;
    for (final (el, value) in [
      (name, name.value),
      (phone, phone.value),
      (text, text.value),
    ]) {
      final empty = value.trim().isEmpty;
      el.classList.toggle('is-invalid', empty);
      if (empty) ok = false;
    }
    error.hidden = ok.toJS;
    if (!ok) return;

    final message =
        'Bonjour KISUSI COMPANY,\n\n'
        '${text.value.trim()}\n\n'
        '— ${name.value.trim()}\n'
        'Tél : ${phone.value.trim()}\n'
        'Objet : ${subject.value}';
    web.window.open(_whatsappLink(message), '_blank');
  });
}

// ---------------------------------------------------------------------------
// Animations d'apparition au défilement
// ---------------------------------------------------------------------------

void _setupReveal() {
  final observer = web.IntersectionObserver(
    (
          JSArray<web.IntersectionObserverEntry> entries,
          web.IntersectionObserver obs,
        ) {
          for (final entry in entries.toDart) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          }
        }
        .toJS,
    web.IntersectionObserverInit(threshold: 0.12.toJS),
  );
  for (final el in _all('.reveal')) {
    observer.observe(el);
  }
}

// ---------------------------------------------------------------------------
// Installation du site comme application (raccourci sur l'écran d'accueil)
// ---------------------------------------------------------------------------

/// Évènement non standard émis par Chrome/Edge/Android quand le site peut
/// être installé.
extension type BeforeInstallPromptEvent._(JSObject _) implements web.Event {
  external JSPromise<JSAny?> prompt();
}

BeforeInstallPromptEvent? _installPrompt;

bool get _isStandalone {
  final navigator = web.window.navigator as JSObject;
  return web.window.matchMedia('(display-mode: standalone)').matches ||
      navigator.getProperty<JSAny?>('standalone'.toJS)?.dartify() == true;
}

bool get _isIos {
  final nav = web.window.navigator;
  return RegExp('iPhone|iPad|iPod').hasMatch(nav.userAgent) ||
      (nav.userAgent.contains('Macintosh') && nav.maxTouchPoints > 1);
}

void _setupInstall() {
  _registerServiceWorker();

  final buttons = _all('[data-install]');
  void showButtons(bool visible) {
    for (final b in buttons) {
      (b as web.HTMLElement).hidden = (!visible).toJS;
    }
  }

  // Déjà ouvert depuis l'icône installée : inutile de proposer le bouton.
  if (_isStandalone) return;
  showButtons(true);

  _on(web.window, 'beforeinstallprompt', (event) {
    event.preventDefault();
    _installPrompt = event as BeforeInstallPromptEvent;
  });
  _on(web.window, 'appinstalled', (_) {
    _installPrompt = null;
    showButtons(false);
  });

  for (final b in buttons) {
    _on(b, 'click', (_) async {
      final prompt = _installPrompt;
      if (prompt != null) {
        _installPrompt = null;
        await prompt.prompt().toDart;
        return;
      }
      _showInstallHelp();
    });
  }
}

/// Affiche les instructions manuelles (iPhone/iPad, ou navigateur qui ne
/// propose pas l'installation automatique).
void _showInstallHelp() {
  (web.document.querySelector('#install-steps-ios') as web.HTMLElement).hidden =
      (!_isIos).toJS;
  (web.document.querySelector(
    '#install-steps-other',
  ) as web.HTMLElement).hidden = _isIos.toJS;
  (web.document.querySelector('#install-dialog') as web.HTMLDialogElement)
      .showModal();
}

Future<void> _registerServiceWorker() async {
  // Indisponible hors HTTPS (sauf localhost) : le site fonctionne quand même.
  if (!(web.window.navigator as JSObject).has('serviceWorker')) return;
  try {
    await web.window.navigator.serviceWorker.register('sw.js'.toJS).toDart;
  } catch (_) {}
}
