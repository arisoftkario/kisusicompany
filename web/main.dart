import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:math' as math;

import 'package:web/web.dart' as web;

/// Numéro WhatsApp de KISUSI COMPANY (format international, sans "+").
const whatsappNumber = '243980957817';

/// Pourcentage d'avance des véhicules d'exemple (les produits publiés ont
/// le leur, fixé dans l'espace administrateur : 60 ou 70 %).
const defaultAdvanceRate = 60;

/// Taux d'intérêt mensuel utilisé par le simulateur de crédit (0.015 = 1,5 %).
/// À ajuster selon les conditions réelles de l'entreprise.
const tauxMensuelCredit = 0.015;

/// Véhicules d'exemple du catalogue. Dès qu'un produit est publié depuis
/// l'espace administrateur (admin.html), les produits publiés les remplacent
/// (voir `web/js/catalog.js`).
const vehicles = <Vehicle>[
  Vehicle(
    name: 'Toyota Tacoma 4x4',
    category: 'Pick-up',
    image: 'pickup.webp',
    year: 2018,
    km: 68000,
    fuel: 'Essence',
    price: 24500,
  ),
  Vehicle(
    name: 'Toyota Camry',
    category: 'Berline',
    image: 'berline.webp',
    year: 2019,
    km: 54000,
    fuel: 'Essence',
    price: 16800,
  ),
  Vehicle(
    name: 'Honda CR-V',
    category: 'SUV',
    image: 'suv.webp',
    year: 2018,
    km: 72000,
    fuel: 'Essence',
    price: 15500,
  ),
  Vehicle(
    name: 'Nissan Juke',
    category: 'SUV',
    image: 'suv-compact.webp',
    year: 2017,
    km: 61000,
    fuel: 'Essence',
    price: 9900,
  ),
  Vehicle(
    name: 'Ford Expedition',
    category: 'SUV',
    image: 'suv-grand.webp',
    year: 2018,
    km: 80000,
    fuel: 'Essence',
    price: 29000,
    fromJapan: false,
  ),
  Vehicle(
    name: 'BMW Série 4 Coupé',
    category: 'Berline',
    image: 'coupe.webp',
    year: 2017,
    km: 66000,
    fuel: 'Essence',
    price: 21500,
    fromJapan: false,
  ),
  Vehicle(
    name: 'KTM RC 390',
    category: 'Moto',
    image: 'moto-sport.webp',
    year: 2020,
    km: 9000,
    fuel: 'Essence',
    price: 4200,
    fromJapan: false,
  ),
  Vehicle(
    name: 'Ducati SuperSport',
    category: 'Moto',
    image: 'moto-route.webp',
    year: 2019,
    km: 12000,
    fuel: 'Essence',
    price: 9800,
    fromJapan: false,
  ),
  Vehicle(
    name: 'Moto Cruiser 250 cc',
    category: 'Moto',
    image: 'moto-cruiser.webp',
    year: 2021,
    km: 6000,
    fuel: 'Essence',
    price: 2900,
  ),
];

class Vehicle {
  /// Identifiant du produit publié ('' pour les véhicules d'exemple).
  final String id;
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
  final bool sold;
  final String description;

  /// Pourcentage du prix demandé en avance à la réservation.
  final int advanceRate;

  /// Photos supplémentaires (adresses complètes), après [image].
  final List<String> photos;

  const Vehicle({
    this.id = '',
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
    this.sold = false,
    this.description = '',
    this.advanceRate = defaultAdvanceRate,
    this.photos = const [],
  });

  /// Produit publié depuis l'espace administrateur (objet préparé par catalog.js).
  factory Vehicle.fromJs(JSObject o) {
    JSAny? get(String key) => o.getProperty<JSAny?>(key.toJS);
    String text(String key) => (get(key) as JSString?)?.toDart ?? '';
    int number(String key) => (get(key) as JSNumber?)?.toDartDouble.round() ?? 0;
    bool flag(String key) => (get(key) as JSBoolean?)?.toDart ?? false;
    final photos = [
      for (final p in (get('photos') as JSArray<JSString>?)?.toDart ?? <JSString>[]) p.toDart,
    ];
    return Vehicle(
      id: text('id'),
      name: text('name'),
      category: text('category'),
      image: photos.isEmpty ? 'og-image.jpg' : photos.first,
      photos: photos.skip(1).toList(),
      year: number('year'),
      km: number('km'),
      fuel: text('fuel'),
      price: number('price'),
      credit: flag('credit'),
      fromJapan: flag('fromJapan'),
      sold: flag('sold'),
      description: text('description'),
      advanceRate: number('depositRate'),
    );
  }

  /// Montant de l'avance demandée à la réservation.
  int get advance => (price * advanceRate / 100).round();
}

/// Catalogue affiché : exemples, ou produits publiés.
List<Vehicle> _vehicles = vehicles;

String _currentFilter = 'Tous';
int _simMonths = 12;

void main() {
  web.document.documentElement!.classList.add('js');

  _setupHeader();
  _setupCatalog();
  _listenForProducts();
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

/// Photo locale (web/images/) ou adresse complète (photo publiée).
String _src(String image) => image.startsWith('http') ? image : 'images/$image';

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
      // Section masquée (ex. « Actualités » sans Firebase) : offsetTop vaut 0.
      if (s.hasAttribute('hidden')) continue;
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
        c.setAttribute('aria-pressed', '${c == chip}');
      }
      _renderCatalog();
    });
  }
  _renderCatalog();
}

/// Produits publiés, envoyés par catalog.js (événement, ou déjà prêts).
void _listenForProducts() {
  void apply(JSAny? detail) {
    if (detail == null || detail.isUndefinedOrNull) return;
    final list = (detail as JSArray<JSObject>).toDart;
    if (list.isEmpty) return;
    _vehicles = [for (final p in list) Vehicle.fromJs(p)];
    _renderCatalog();
  }

  _on(web.window, 'kisusi:products', (e) => apply((e as web.CustomEvent).detail));
  apply(web.window.getProperty<JSAny?>('kisusiProducts'.toJS));
}

void _renderCatalog() {
  final container = web.document.querySelector('#catalog')!;
  final items = _vehicles.where(
    (v) => _currentFilter == 'Tous' || v.category == _currentFilter,
  );

  final html = StringBuffer();
  var i = 0;
  for (final v in items) {
    final index = _vehicles.indexOf(v);
    final message =
        'Bonjour KISUSI COMPANY, je suis intéressé(e) par le '
        'véhicule "${v.name}" (${v.year}) affiché à ${_usd(v.price)} '
        'sur votre site. Est-il toujours disponible ?';
    html.write('''
<article class="card${v.sold ? ' is-sold' : ''}"${v.id.isEmpty ? '' : ' id="produit-${_escape(v.id)}"'} style="animation-delay:${i++ * 70}ms">
  <div class="card__media">
    ${v.photos.isEmpty ? '<img src="${_escape(_src(v.image))}" alt="${_escape(v.name)}" loading="lazy">' : '<div class="card__slides">${[v.image, ...v.photos].map((p) => '<img src="${_escape(_src(p))}" alt="${_escape(v.name)}" loading="lazy">').join()}</div><span class="card__count">${v.photos.length + 1} photos ›</span>'}
    <span class="card__cat">${_escape(v.category)}</span>
    ${v.sold ? '<span class="card__sold">Vendu</span>' : ''}
    ${v.fromJapan ? '<span class="card__origin"><svg class="flag" viewBox="0 0 30 20" aria-hidden="true"><use href="#f-jp"/></svg>Import Japon</span>' : ''}
  </div>
  <div class="card__body">
    <div class="card__pay">
      ${v.cash ? '<span>Cash</span>' : ''}
      ${v.credit ? '<span class="is-credit">Crédit</span>' : ''}
    </div>
    <h3 class="card__title">${_escape(v.name)}</h3>
    ${v.description.isEmpty ? '' : '<p class="card__desc">${_escape(v.description)}</p>'}
    <ul class="card__specs">
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-calendar"/></svg>${v.year}</li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-gauge"/></svg>${_fmt(v.km)} km</li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-fuel"/></svg>${_escape(v.fuel)}</li>
    </ul>
    <div class="card__foot">
      <div class="card__price"><small>Prix</small><strong>${_usd(v.price)}</strong>${v.sold ? '' : '<span class="card__advance">Avance ${v.advanceRate} % : ${_usd(v.advance)}</span>'}</div>
      <div class="card__actions">
        ${v.credit && !v.sold ? '<button type="button" class="icon-btn" data-simulate="$index" title="Simuler un crédit" aria-label="Simuler un crédit pour ${_escape(v.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-calendar"/></svg></button>' : ''}
        <a class="icon-btn icon-btn--wa" href="${_whatsappLink(message)}" target="_blank" rel="noopener" title="Commander sur WhatsApp" aria-label="Commander ${_escape(v.name)} sur WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-whatsapp"/></svg></a>
      </div>
    </div>
    ${v.sold ? '' : '<button type="button" class="btn btn--red btn--sm btn--block card__order" data-order="${_escape(v.name)}" data-year="${v.year}" data-price="${v.price}" data-deposit="${v.advance}" data-credit="${v.credit}">Réserver en ligne</button>'}
  </div>
</article>''');
  }
  container.innerHTML = html.toString().toJS;

  for (final btn in _all('#catalog [data-simulate]')) {
    _on(btn, 'click', (_) {
      final v = _vehicles[int.parse(btn.getAttribute('data-simulate')!)];
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
        d.setAttribute('aria-pressed', '${d == b}');
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
