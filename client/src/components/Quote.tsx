import { Card } from './ui'

/**
 * One line a day, in Hebrew, drawn from a fixed list.
 *
 * Bundled rather than fetched: no key, no request, no outage, and it works offline. The
 * list is short on purpose. A hundred forgettable lines would be worse than thirty that
 * are worth reading twice.
 */
const QUOTES: readonly { text: string; author: string }[] = [
  { text: 'לא עליך המלאכה לגמור, ולא אתה בן חורין להיבטל ממנה.', author: 'פרקי אבות' },
  { text: 'איזהו גיבור? הכובש את יצרו.', author: 'פרקי אבות' },
  { text: 'אם תרצו, אין זו אגדה.', author: 'הרצל' },
  { text: 'אם אין אני לי, מי לי? וכשאני לעצמי, מה אני? ואם לא עכשיו, אימתי?', author: 'הלל הזקן' },
  { text: 'לפום צערא אגרא. השכר לפי הקושי.', author: 'פרקי אבות' },
  { text: 'שבע יפול צדיק, וקם.', author: 'משלי' },
  { text: 'מסע של אלף מילין מתחיל בצעד אחד.', author: 'לאו דזה' },
  { text: 'אנחנו מה שאנחנו עושים שוב ושוב. מצוינות היא הרגל, לא מעשה.', author: 'אריסטו' },
  { text: 'קשה באימונים, קל בקרב.', author: 'סווורוב' },
  { text: 'לא כי הדברים קשים אנחנו לא מעזים. כי אנחנו לא מעזים הם קשים.', author: 'סנקה' },
  { text: 'המכשול שבדרך הוא הדרך.', author: 'מרקוס אורליוס' },
  { text: 'יש לך שליטה על דעתך, לא על מה שקורה בחוץ. הבן זאת ותמצא כוח.', author: 'מרקוס אורליוס' },
  { text: 'ראשית עשה את ההכרחי, אחר כך את האפשרי, ופתאום אתה עושה את הבלתי אפשרי.', author: 'פרנציסקוס מאסיזי' },
  { text: 'מי שיש לו למה לחיות, יעמוד כמעט בכל איך.', author: 'ניטשה' },
  { text: 'אל תשפוט כל יום לפי היבול שקצרת, אלא לפי הזרעים שזרעת.', author: 'רוברט לואיס סטיבנסון' },
  { text: 'אין מעלית להצלחה. צריך לעלות במדרגות.', author: 'זיג זיגלר' },
  { text: 'משמעת היא הגשר בין מטרות להישגים.', author: 'ג׳ים רון' },
  { text: 'אנחנו סובלים או ממשמעת או מחרטה. תבחר.', author: 'ג׳ים רון' },
  { text: 'הסוד להתקדם הוא להתחיל.', author: 'מארק טוויין' },
  { text: 'אם אתה עובר בגיהינום, אל תעצור. תמשיך ללכת.', author: 'צ׳רצ׳יל' },
  { text: 'הצלחה היא לעבור מכישלון לכישלון בלי לאבד את ההתלהבות.', author: 'צ׳רצ׳יל' },
  { text: 'קשה יותר לשנות הרגל מאשר לבנות אותו. לכן כדאי לבנות אותו נכון.', author: 'פתגם' },
  { text: 'עשה או אל תעשה. אין דבר כזה לנסות.', author: 'יודה' },
  { text: 'הדרך היחידה לעשות עבודה גדולה היא לאהוב את מה שאתה עושה.', author: 'סטיב ג׳ובס' },
  { text: 'אתה לא עולה לגובה השאיפות שלך. אתה יורד לרמת השיטות שלך.', author: 'ארצ׳ילוכוס' },
  { text: 'הזמן הכי טוב לשתול עץ היה לפני עשרים שנה. השני הכי טוב הוא היום.', author: 'פתגם סיני' },
  { text: 'טיפה אחר טיפה נשחקת האבן.', author: 'פתגם' },
  { text: 'מי שרוצה לעשות, מוצא דרך. מי שלא רוצה, מוצא תירוץ.', author: 'פתגם' },
  { text: 'לא הביישן למד ולא הקפדן מלמד.', author: 'פרקי אבות' },
  { text: 'במקום שאין אנשים, השתדל להיות איש.', author: 'פרקי אבות' },
  { text: 'הניצחון הראשון והטוב ביותר הוא לנצח את עצמך.', author: 'אפלטון' },
  { text: 'ההרגל הוא חבל. כל יום שוזרים חוט, ובסוף אי אפשר לנתק אותו.', author: 'הוראס מאן' },
]

/**
 * Same quote all day, and the same one on every device.
 *
 * Keyed off the log date rather than picked at random, so a re-render or a reload never
 * swaps it out mid-thought.
 */
function quoteForDate(date: string) {
  let hash = 0
  for (let i = 0; i < date.length; i++) {
    hash = (hash * 31 + date.charCodeAt(i)) % 1_000_003
  }
  return QUOTES[hash % QUOTES.length]!
}

export function Quote({ date }: { date: string }) {
  const { text, author } = quoteForDate(date)

  return (
    <Card>
      <p dir="rtl" className="text-[15px] leading-relaxed text-ink-soft">
        {text}
      </p>
      {/*
        Not `.eyebrow`: it tracks letters out by 0.22em and uppercases them, and Hebrew
        has no uppercase and should not be tracked. Same muted role, set plainly.
      */}
      <p dir="rtl" className="mt-3 text-[12px] text-ink-muted">
        {author}
      </p>
    </Card>
  )
}
