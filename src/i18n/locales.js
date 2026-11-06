// Translation table (H5 §8, vanilla.md §9). One row = key + all 10 languages in fixed order,
// so a language cannot be forgotten structurally. Order of languages = cycle/list order.

export const LANGS = ['en', 'uk', 'ru', 'de', 'it', 'fr', 'es', 'pt', 'ar', 'ja'];

/** Language names in their own language — never translated. */
export const LANG_NAMES = {
  en: 'English', uk: 'Українська', ru: 'Русский', de: 'Deutsch', it: 'Italiano',
  fr: 'Français', es: 'Español', pt: 'Português', ar: 'العربية', ja: '日本語',
};

// [key, en, uk, ru, de, it, fr, es, pt, ar, ja]
const ROWS = [
  ['tap.toPlay', 'TAP TO PLAY', 'ТОРКНІТЬСЯ, ЩОБ ГРАТИ', 'НАЖМИТЕ, ЧТОБЫ ИГРАТЬ', 'TIPPEN ZUM SPIELEN', 'TOCCA PER GIOCARE', 'TOUCHEZ POUR JOUER', 'TOCA PARA JUGAR', 'TOQUE PARA JOGAR', 'انقر للعب', 'タップしてプレイ'],

  ['menu.newGame', 'NEW GAME', 'НОВА ГРА', 'НОВАЯ ИГРА', 'NEUES SPIEL', 'NUOVA PARTITA', 'NOUVELLE PARTIE', 'NUEVA PARTIDA', 'NOVO JOGO', 'لعبة جديدة', 'ニューゲーム'],
  ['menu.settings', 'SETTINGS', 'НАЛАШТУВАННЯ', 'НАСТРОЙКИ', 'EINSTELLUNGEN', 'IMPOSTAZIONI', 'PARAMÈTRES', 'AJUSTES', 'CONFIGURAÇÕES', 'الإعدادات', '設定'],
  ['menu.credits', 'CREDITS', 'ТИТРИ', 'ТИТРЫ', 'CREDITS', 'RICONOSCIMENTI', 'CRÉDITS', 'CRÉDITOS', 'CRÉDITOS', 'الاعتمادات', 'クレジット'],

  ['aria.fullscreen', 'Fullscreen', 'Повний екран', 'Полный экран', 'Vollbild', 'Schermo intero', 'Plein écran', 'Pantalla completa', 'Tela cheia', 'ملء الشاشة', '全画面'],
  ['aria.reset', 'Reset progress', 'Скинути прогрес', 'Сбросить прогресс', 'Fortschritt zurücksetzen', 'Azzera progressi', 'Réinitialiser la progression', 'Restablecer progreso', 'Redefinir progresso', 'إعادة تعيين التقدم', '進行状況をリセット'],
  ['aria.settings', 'Settings', 'Налаштування', 'Настройки', 'Einstellungen', 'Impostazioni', 'Paramètres', 'Ajustes', 'Configurações', 'الإعدادات', '設定'],
  ['aria.exit', 'Exit to menu', 'Вийти в меню', 'Выйти в меню', 'Zum Menü', 'Esci al menu', 'Retour au menu', 'Salir al menú', 'Sair para o menu', 'الخروج إلى القائمة', 'メニューへ戻る'],
  ['aria.close', 'Close', 'Закрити', 'Закрыть', 'Schließen', 'Chiudi', 'Fermer', 'Cerrar', 'Fechar', 'إغلاق', '閉じる'],
  ['aria.back', 'Back', 'Назад', 'Назад', 'Zurück', 'Indietro', 'Retour', 'Atrás', 'Voltar', 'رجوع', '戻る'],

  ['tab.game', 'GAME', 'ГРА', 'ИГРА', 'SPIEL', 'GIOCO', 'JEU', 'JUEGO', 'JOGO', 'اللعبة', 'ゲーム'],
  ['tab.video', 'VIDEO', 'ГРАФІКА', 'ГРАФИКА', 'GRAFIK', 'GRAFICA', 'GRAPHISMES', 'GRÁFICOS', 'GRÁFICOS', 'الرسومات', 'グラフィック'],
  ['tab.audio', 'AUDIO', 'ЗВУК', 'ЗВУК', 'AUDIO', 'AUDIO', 'AUDIO', 'AUDIO', 'ÁUDIO', 'الصوت', 'サウンド'],
  ['tab.language', 'LANGUAGE', 'МОВА', 'ЯЗЫК', 'SPRACHE', 'LINGUA', 'LANGUE', 'IDIOMA', 'IDIOMA', 'اللغة', '言語'],
  ['settings.build', 'BUILD {v}', 'ЗБІРКА {v}', 'СБОРКА {v}', 'BUILD {v}', 'BUILD {v}', 'VERSION {v}', 'VERSIÓN {v}', 'VERSÃO {v}', 'الإصدار {v}', 'ビルド {v}'],

  ['game.progress', 'PROGRESS', 'ПРОГРЕС', 'ПРОГРЕСС', 'FORTSCHRITT', 'PROGRESSI', 'PROGRESSION', 'PROGRESO', 'PROGRESSO', 'التقدم', '進行状況'],
  ['game.resetBtn', 'RESET PROGRESS', 'СКИНУТИ ПРОГРЕС', 'СБРОСИТЬ ПРОГРЕСС', 'ZURÜCKSETZEN', 'AZZERA PROGRESSI', 'RÉINITIALISER', 'RESTABLECER', 'REDEFINIR', 'إعادة التعيين', 'リセット'],
  ['game.resetHint',
    'Erases coins, experience, weapons and upgrades. Sound, music and language settings are kept.',
    'Видаляє монети, досвід, зброю та покращення. Налаштування звуку, музики й мови зберігаються.',
    'Удаляет монеты, опыт, оружие и улучшения. Настройки звука, музыки и языка сохраняются.',
    'Löscht Münzen, Erfahrung, Waffen und Verbesserungen. Ton-, Musik- und Spracheinstellungen bleiben erhalten.',
    'Cancella monete, esperienza, armi e potenziamenti. Le impostazioni di audio, musica e lingua restano.',
    "Efface les pièces, l'expérience, les armes et les améliorations. Les réglages du son, de la musique et de la langue sont conservés.",
    'Borra monedas, experiencia, armas y mejoras. Se conservan los ajustes de sonido, música e idioma.',
    'Apaga moedas, experiência, armas e melhorias. As configurações de som, música e idioma são mantidas.',
    'يمحو العملات والخبرة والأسلحة والتحسينات. تبقى إعدادات الصوت والموسيقى واللغة.',
    'コイン、経験値、武器、強化を消去します。サウンド・音楽・言語の設定は保持されます。'],

  ['video.quality', 'GRAPHICS QUALITY', 'ЯКІСТЬ ГРАФІКИ', 'КАЧЕСТВО ГРАФИКИ', 'GRAFIKQUALITÄT', 'QUALITÀ GRAFICA', 'QUALITÉ GRAPHIQUE', 'CALIDAD GRÁFICA', 'QUALIDADE GRÁFICA', 'جودة الرسومات', '画質'],
  ['video.auto', 'Automatic', 'Автоматично', 'Автоматически', 'Automatisch', 'Automatica', 'Automatique', 'Automática', 'Automática', 'تلقائي', '自動'],
  ['video.fastest', 'Fastest', 'Найшвидше', 'Быстрее', 'Schnellste', 'Più veloce', 'Plus rapide', 'Más rápido', 'Mais rápido', 'الأسرع', '高速'],
  ['video.best', 'Best looking', 'Найкрасивіше', 'Красивее', 'Beste Optik', 'Più bella', 'Plus beau', 'Mejor aspecto', 'Melhor visual', 'الأجمل', '高画質'],
  ['quality.low', 'Low', 'Низька', 'Низкое', 'Niedrig', 'Bassa', 'Basse', 'Baja', 'Baixa', 'منخفضة', '低'],
  ['quality.medium', 'Medium', 'Середня', 'Среднее', 'Mittel', 'Media', 'Moyenne', 'Media', 'Média', 'متوسطة', '中'],
  ['quality.high', 'High', 'Висока', 'Высокое', 'Hoch', 'Alta', 'Haute', 'Alta', 'Alta', 'عالية', '高'],

  ['audio.header', 'SOUND & MUSIC', 'ЗВУК І МУЗИКА', 'ЗВУК И МУЗЫКА', 'TON & MUSIK', 'AUDIO E MUSICA', 'SON ET MUSIQUE', 'SONIDO Y MÚSICA', 'SOM E MÚSICA', 'الصوت والموسيقى', 'サウンドと音楽'],
  ['audio.sound', 'Sound effects', 'Звукові ефекти', 'Звуковые эффекты', 'Soundeffekte', 'Effetti sonori', 'Effets sonores', 'Efectos de sonido', 'Efeitos sonoros', 'المؤثرات الصوتية', '効果音'],
  ['audio.music', 'Music', 'Музика', 'Музыка', 'Musik', 'Musica', 'Musique', 'Música', 'Música', 'الموسيقى', '音楽'],

  ['confirm.reset',
    'Reset all progress? This cannot be undone.',
    'Скинути весь прогрес? Цю дію не можна скасувати.',
    'Сбросить весь прогресс? Это действие нельзя отменить.',
    'Gesamten Fortschritt zurücksetzen? Dies kann nicht rückgängig gemacht werden.',
    "Azzerare tutti i progressi? L'operazione non può essere annullata.",
    'Réinitialiser toute la progression ? Cette action est irréversible.',
    '¿Restablecer todo el progreso? No se puede deshacer.',
    'Redefinir todo o progresso? Isso não pode ser desfeito.',
    'إعادة تعيين كل التقدم؟ لا يمكن التراجع عن ذلك.',
    'すべての進行状況をリセットしますか？元に戻せません。'],
  ['confirm.exit',
    'Leave the map and return to the main menu? This map run will be lost.',
    'Покинути карту й повернутися в головне меню? Поточне проходження карти буде втрачено.',
    'Покинуть карту и вернуться в главное меню? Текущее прохождение карты будет потеряно.',
    'Karte verlassen und zum Hauptmenü zurückkehren? Der aktuelle Durchgang geht verloren.',
    'Lasciare la mappa e tornare al menu principale? La partita in corso andrà persa.',
    'Quitter la carte et revenir au menu principal ? La partie en cours sera perdue.',
    '¿Salir del mapa y volver al menú principal? Se perderá la partida actual.',
    'Sair do mapa e voltar ao menu principal? A partida atual será perdida.',
    'مغادرة الخريطة والعودة إلى القائمة الرئيسية؟ ستفقد الجولة الحالية.',
    'マップを離れてメインメニューに戻りますか？現在のプレイは失われます。'],
  ['common.yes', 'YES', 'ТАК', 'ДА', 'JA', 'SÌ', 'OUI', 'SÍ', 'SIM', 'نعم', 'はい'],
  ['common.no', 'NO', 'НІ', 'НЕТ', 'NEIN', 'NO', 'NON', 'NO', 'NÃO', 'لا', 'いいえ'],

  ['map.ashen_coast.name', 'ASHEN COAST', 'ПОПІЛЬНЕ УЗБЕРЕЖЖЯ', 'ПЕПЕЛЬНОЕ ПОБЕРЕЖЬЕ', 'ASCHENKÜSTE', 'COSTA DI CENERE', 'CÔTE DE CENDRES', 'COSTA CENICIENTA', 'COSTA DAS CINZAS', 'ساحل الرماد', '灰の海岸'],
  ['map.ashen_coast.desc',
    'A drowned coast swallowed by fog. Keep the last beacon burning.',
    'Затоплене узбережжя, поглинуте туманом. Не дай згаснути останньому маяку.',
    'Затопленное побережье, поглощённое туманом. Не дай погаснуть последнему маяку.',
    'Eine versunkene Küste, vom Nebel verschluckt. Halte das letzte Leuchtfeuer am Brennen.',
    "Una costa sommersa, inghiottita dalla nebbia. Tieni acceso l'ultimo faro.",
    'Une côte noyée, engloutie par la brume. Garde le dernier phare allumé.',
    'Una costa anegada, tragada por la niebla. Mantén encendido el último faro.',
    'Uma costa afogada, engolida pela névoa. Mantenha o último farol aceso.',
    'ساحل غارق ابتلعه الضباب. أبقِ المنارة الأخيرة مشتعلة.',
    '霧に呑まれた沈みゆく海岸。最後の灯台を守り抜け。'],
  ['map.waves', 'WAVES: {n}', 'ХВИЛІ: {n}', 'ВОЛНЫ: {n}', 'WELLEN: {n}', 'ONDATE: {n}', 'VAGUES : {n}', 'OLEADAS: {n}', 'ONDAS: {n}', 'الموجات: {n}', 'ウェーブ: {n}'],
  ['map.boss', 'Final wave: boss', 'Остання хвиля: бос', 'Последняя волна: босс', 'Letzte Welle: Boss', 'Ultima ondata: boss', 'Dernière vague : boss', 'Última oleada: jefe', 'Última onda: chefe', 'الموجة الأخيرة: زعيم', '最終ウェーブ：ボス'],
  ['map.begin', 'BEGIN', 'ПОЧАТИ', 'НАЧАТЬ', 'START', 'INIZIA', 'COMMENCER', 'COMENZAR', 'COMEÇAR', 'ابدأ', '開始'],

  ['hud.keeper', 'KEEPER', 'ДОГЛЯДАЧ', 'СМОТРИТЕЛЬ', 'WÄRTER', 'GUARDIANO', 'GARDIEN', 'GUARDIÁN', 'GUARDIÃO', 'الحارس', '灯台守'],
  ['hud.reloading', 'RELOADING', 'ПЕРЕЗАРЯДЖАННЯ', 'ПЕРЕЗАРЯДКА', 'NACHLADEN', 'RICARICA', 'RECHARGEMENT', 'RECARGANDO', 'RECARREGANDO', 'إعادة التلقيم', 'リロード中'],
  ['aria.dash', 'Dash', 'Ривок', 'Рывок', 'Ausweichen', 'Scatto', 'Esquive', 'Esquivar', 'Esquiva', 'اندفاع', 'ダッシュ'],
  ['aria.reload', 'Reload', 'Перезарядити', 'Перезарядить', 'Nachladen', 'Ricarica', 'Recharger', 'Recargar', 'Recarregar', 'إعادة التلقيم', 'リロード'],

  ['weapon.pistol', 'SERVICE PISTOL', 'СЛУЖБОВИЙ ПІСТОЛЕТ', 'СЛУЖЕБНЫЙ ПИСТОЛЕТ', 'DIENSTPISTOLE', "PISTOLA D'ORDINANZA", 'PISTOLET DE SERVICE', 'PISTOLA REGLAMENTARIA', 'PISTOLA DE SERVIÇO', 'مسدس الخدمة', '制式拳銃'],
  ['weapon.smg', 'COMPACT SMG', 'КОМПАКТНИЙ ПП', 'КОМПАКТНЫЙ ПП', 'KOMPAKT-MP', 'SMG COMPATTO', 'PM COMPACT', 'SUBFUSIL COMPACTO', 'SUBMETRALHADORA COMPACTA', 'رشاش صغير', '小型サブマシンガン'],
  ['weapon.shotgun', 'PUMP SHOTGUN', 'ПОМПОВА РУШНИЦЯ', 'ПОМПОВЫЙ ДРОБОВИК', 'PUMPGUN', 'FUCILE A POMPA', 'FUSIL À POMPE', 'ESCOPETA DE CORREDERA', 'ESPINGARDA DE BOMBA', 'بندقية مضخية', 'ポンプショットガン'],
  ['weapon.assault_rifle', 'ASSAULT RIFLE', 'ШТУРМОВА ГВИНТІВКА', 'ШТУРМОВАЯ ВИНТОВКА', 'STURMGEWEHR', "FUCILE D'ASSALTO", "FUSIL D'ASSAUT", 'FUSIL DE ASALTO', 'FUZIL DE ASSALTO', 'بندقية هجومية', 'アサルトライフル'],
  ['weapon.machine_gun', 'HEAVY MACHINE GUN', 'ВАЖКИЙ КУЛЕМЕТ', 'ТЯЖЁЛЫЙ ПУЛЕМЁТ', 'SCHWERES MG', 'MITRAGLIATRICE PESANTE', 'MITRAILLEUSE LOURDE', 'AMETRALLADORA PESADA', 'METRALHADORA PESADA', 'رشاش ثقيل', '重機関銃'],

  ['hud.paused', 'GAME PAUSED', 'ГРУ ПРИЗУПИНЕНО', 'ИГРА НА ПАУЗЕ', 'PAUSIERT', 'GIOCO IN PAUSA', 'JEU EN PAUSE', 'JUEGO EN PAUSA', 'JOGO PAUSADO', 'اللعبة متوقفة', '一時停止中'],
];

/** LOCALES[lang][key] = string */
export const LOCALES = Object.fromEntries(
  LANGS.map((lang, col) => [lang, Object.fromEntries(ROWS.map((row) => [row[0], row[col + 1]]))]),
);

export const ROW_COUNT = ROWS.length;
export const RAW_ROWS = ROWS;
