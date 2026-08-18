import io
p='src/app/messages/[userId]/page.tsx'
s=io.open(p,encoding='utf-8').read()

old = """        <div className="glass flex w-full max-w-2xl items-center gap-2 rounded-full py-1 pl-4 pr-1.5">
          <input
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Сообщение"
            enterKeyHint="send"
            className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[15px] text-[var(--text)] outline-none"
          />
          {/* Кнопка отправки вырастает, когда есть что отправлять: пустая
              строка не предлагает нажать. */}
          <button
            type="submit"
            disabled={!body.trim() || sending}
            aria-label={editing ? 'Сохранить' : 'Отправить'}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              transform: body.trim() ? 'scale(1)' : 'scale(0.7)',
              opacity: body.trim() ? 1 : 0.35,
              transition:
                'transform 0.24s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
            }}
          >"""

new = open('/tmp/new_block.txt', encoding='utf-8').read()
assert old in s, 'MISS composer'
s = s.replace(old, new)

old2 = """              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M12 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </div>
      </form>,"""
new2 = open('/tmp/new_tail.txt', encoding='utf-8').read()
assert old2 in s, 'MISS submit tail'
s = s.replace(old2, new2)
io.open(p,'w',encoding='utf-8').write(s)
print('ok')
