// Site bilgileri — SEO, structured data, sitemap, humans.txt vb.
// için tek kaynak. Bilgi değiştirmek istediğinde sadece burayı güncelle.

export const SITE = {
  domain: 'https://rabiagol.com',
  name: 'Rabia Göl',
  legalName: 'Rabia Göl',
  alternateName: 'Rabia Göl Animation',
  jobTitle: {
    en: '3D Character Animator',
    tr: '3D Karakter Animatörü',
  },
  description: {
    en: 'Rabia Göl - Professional 3D Character Animator. Creative projects focused on character animation and storytelling.',
    tr: 'Rabia Göl - Antalya merkezli profesyonel 3D Karakter Animatörü. Karakter animasyonu, hikaye anlatımı ve yaratıcı 3D karakter animasyonu projeleri geliştiriyorum.',
  },
  shortDescription: {
    en: 'Professional 3D Character Animator portfolio.',
    tr: 'Profesyonel 3D Karakter Animatörü portfolyosu.',
  },
  slogan: {
    en: 'Bringing Stories to Life Through Animation',
    tr: 'Hikayeleri Animasyonla Hayata Geçiriyorum',
  },
  keywords: [
    '3D Karakter Animatörü',
    '3D character animator',
    'Rabia Göl',
    'Maya animator',
    'karakter animasyonu',
    'character animation',
    '3D animasyon',
    '3D animation',
    'animasyon tasarım',
    'Antalya animator',
    'profesyonel animator',
    'hikaye anlatımı',
    'storytelling',
    'showreel',
    'portfolio',
    'portfolyo',
    'demo reel',
    'Maya animation',
    'freelance animator',
  ],
  // Logo ve sosyal görseller (public/ altından servis edilir)
  logo: '/logo.png',
  ogImage: '/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterImage: '/twitter-card.png',
  themeColor: '#0f0f0f',

  contact: {
    email: 'contact@rabiagol.com',
  },

  // Antalya / Türkiye (eski portfolyo ile aynı). Adres değişirse buradan güncelle.
  location: {
    city: 'Antalya',
    region: 'Antalya',
    regionCode: 'TR-07',
    country: 'TR',
    countryName: 'Turkey',
    postalCode: '07070',
    streetAddress: 'Konyaaltı',
    latitude: 36.8969,
    longitude: 30.7133,
  },

  social: {
    linkedin: 'https://tr.linkedin.com/in/rabia-g%C3%B6l-62b13a210',
    vimeo: 'https://vimeo.com/user143976662',
    instagram: 'https://instagram.com/_ma_ma_miaa',
  },

  education: {
    en: {
      institution: 'Sakarya University of Applied Sciences',
      department: 'Computer-Aided Design and Animation',
    },
    tr: {
      institution: 'Sakarya Uygulamalı Bilimler Üniversitesi',
      department: 'Bilgisayar Destekli Tasarım ve Animasyon',
    },
  },

  skills: [
    '3D Animation',
    'Character Animation',
    'Maya Software',
    'Storytelling',
    'Visual Effects',
    'Motion Graphics',
    'Digital Art',
    'Computer Graphics',
  ],

  services: [
    {
      name: { en: '3D Character Animation', tr: '3D Karakter Animasyonu' },
      description: {
        en: 'Professional character animation services using Maya software.',
        tr: 'Maya yazılımı ile profesyonel karakter animasyonu hizmeti.',
      },
    },
    {
      name: { en: 'Storytelling Animation', tr: 'Hikaye Anlatımı Animasyonu' },
      description: {
        en: 'Creative animation projects focused on narrative and storytelling.',
        tr: 'Hikaye anlatımına ve yaratıcı sahne tasarımına odaklı animasyon projeleri.',
      },
    },
    {
      name: { en: 'Game Character Animation', tr: 'Oyun Karakter Animasyonu' },
      description: {
        en: 'Idle, walk cycles, attacks and interaction animations for Unity and Unreal Engine.',
        tr: 'Unity ve Unreal Engine için idle, yürüyüş döngüsü, saldırı ve etkileşim animasyonları.',
      },
    },
  ],

  // Sık sorulan sorular — info sayfası ve FAQ schema için.
  faq: [
    {
      tr: {
        q: '3D Karakter Animatörü ne yapar?',
        a: 'Karakterlerin duygularını, hareketlerini ve performanslarını canlandırır. Yürüyüş, koşu, mimik, diyalog ve sahne performansı gibi tüm hareketleri hikayeyi destekleyecek şekilde oluştururum.',
      },
      en: {
        q: 'What does a 3D character animator do?',
        a: 'I bring characters to life by animating their emotions, movements and performances — walks, runs, facial expressions, dialogue and scene performance — always in service of the story.',
      },
    },
    {
      tr: {
        q: 'Hangi yazılımları kullanıyorsunuz?',
        a: 'Ana aracım Autodesk Maya. Proje gereksinimine göre ek araçlar ve eklentiler kullanabilirim.',
      },
      en: {
        q: 'Which software do you use?',
        a: 'Autodesk Maya is my main tool. I use additional tools and plugins as needed for each project.',
      },
    },
    {
      tr: {
        q: 'Freelance çalışıyor musunuz?',
        a: 'Evet. Türkiye ve yurt dışından bireysel ya da kurumsal müşterilerle freelance olarak çalışıyorum.',
      },
      en: {
        q: 'Do you work as a freelancer?',
        a: 'Yes. I work with individual and corporate clients from Turkey and abroad on a freelance basis.',
      },
    },
    {
      tr: {
        q: 'Uzaktan çalışabilir misiniz?',
        a: 'Evet. Tüm projeleri uzaktan, düzenli geri bildirim ve teslim planı ile yönetiyorum.',
      },
      en: {
        q: 'Can you work remotely?',
        a: 'Absolutely. I run all projects remotely with regular check-ins and a clear delivery plan.',
      },
    },
    {
      tr: {
        q: 'Teslim süresi ne kadar?',
        a: 'Süre, sahnenin karmaşıklığına ve karakter sayısına göre değişir. Kısa planlar birkaç gün, daha kapsamlı sahneler birkaç hafta sürebilir.',
      },
      en: {
        q: 'How long does delivery take?',
        a: 'It depends on scene complexity and the number of characters. Short shots take a few days; larger scenes can take several weeks.',
      },
    },
    {
      tr: {
        q: 'Oyun karakteri animasyonu yapıyor musunuz?',
        a: 'Evet, oyun projeleri için karakter animasyonu yapıyorum. Idle, yürüyüş döngüleri, saldırı animasyonları ve etkileşim animasyonları gibi oyun içi tüm karakter hareketlerini Unity ve Unreal Engine uyumlu formatlarda teslim edebilirim.',
      },
      en: {
        q: 'Do you animate game characters?',
        a: 'Yes — idle, walk cycles, attacks, and interaction animations, delivered in formats compatible with Unity and Unreal Engine.',
      },
    },
  ],
};

/**
 * `https://rabiagol.com/foo` gibi tam URL üretir.
 * Path'in başında `/` zorunlu değildir.
 */
export function abs(path = '/') {
  const p = String(path || '/').trim();
  if (/^https?:\/\//i.test(p)) return p;
  return `${SITE.domain}${p.startsWith('/') ? p : `/${p}`}`;
}

/**
 * Site'da bilinen sosyal hesapların listesi (Person.sameAs için).
 */
export function socialLinks() {
  return Object.values(SITE.social).filter(Boolean);
}
