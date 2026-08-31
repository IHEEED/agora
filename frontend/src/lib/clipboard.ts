'use client';

/**
 * Скопировать текст, чем получится.
 *
 * Семь мест звали `navigator.clipboard.writeText` напрямую и каждое по-своему
 * ловило отказ. Отказывает он чаще, чем кажется, и по трём разным причинам:
 *
 * 1. Соединение не защищено. `navigator.clipboard` существует только в
 *    защищённом контексте — то есть по HTTPS или на localhost. На телефоне,
 *    открывшем приложение по домашней сети (`http://192.168…`), объекта нет
 *    вовсе, и обращение к нему падает ещё до всякого разрешения.
 * 2. Safari на iOS требует, чтобы запись в буфер случилась внутри жеста
 *    человека. Любое ожидание перед ней — запрос к серверу, чтение файла —
 *    жест «тратит», и следующий за ним вызов отклоняется без объяснений.
 * 3. Браузер может просто не дать разрешения.
 *
 * Поэтому здесь два пути. Сначала современный; если его нет или он отказал —
 * старый `execCommand('copy')`, который работает и без защищённого соединения,
 * потому что копирует не из кода, а из выделения на странице.
 *
 * Старый путь давно объявлен устаревшим, и это не повод его выбрасывать: замены
 * для небезопасного контекста у него нет, а «скопировать» — то действие, после
 * которого человек сразу идёт вставлять. Молчаливый отказ здесь дороже
 * устаревшего вызова.
 */

/**
 * @returns Удалось ли. Ошибку не бросаем: вызывающему нужно решение
 *          «показывать ли отказ», а не разбор причины.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof document === 'undefined' || !text) return false;

  // Путь первый: современный. В защищённом контексте он единственный, который
  // работает при заблокированном экране выделения и не трогает разметку.
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Молча: за отказом идёт запасной путь, и рассказывать о первом незачем.
  }

  // Путь второй: через выделение. Работает везде, где есть DOM.
  try {
    const field = document.createElement('textarea');
    field.value = text;

    // readOnly, а не disabled: отключённое поле нельзя выделить, а на iOS
    // ещё и открывается клавиатура при фокусе на обычном поле. readOnly
    // выделяется и клавиатуру не зовёт.
    field.readOnly = true;
    field.setAttribute('aria-hidden', 'true');

    // Не display:none и не visibility:hidden — из скрытого поля выделять
    // нечего, и копирование вернёт пустоту. Прячем вынесением за кромку,
    // сохранив полю настоящий размер.
    field.style.cssText =
      'position:fixed;top:0;left:-9999px;width:1px;height:1px;padding:0;border:0;opacity:0';

    document.body.appendChild(field);

    // Safari на iOS игнорирует select() у textarea и требует диапазона.
    const range = document.createRange();
    range.selectNodeContents(field);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    field.setSelectionRange(0, text.length);

    const ok = document.execCommand('copy');
    selection?.removeAllRanges();
    field.remove();
    return ok;
  } catch {
    return false;
  }
}
