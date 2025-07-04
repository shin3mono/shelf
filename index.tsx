import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import domtoimage from 'dom-to-image-more';

type Book = {
  id: number;
  url: string;
  comment: string;
  book_order: number;
};

function extractASIN(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
  return match ? match[1] : null;
}

function getCoverImageUrl(asin: string): string {
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`;
}

function SortableBook({ book }: { book: Book }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: book.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: '150px',
    textAlign: 'center' as const,
    padding: '1rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  };

  const asin = extractASIN(book.url);
  const imageUrl = asin ? getCoverImageUrl(asin) : '';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Book cover"
          style={{ width: '100%', marginBottom: '0.5rem' }}
        />
      )}
    </div>
  );
}

// 並び替えの方向を横向きに設定
const horizontalListStrategy = (args: any) =>
  verticalListSortingStrategy({ ...args, axis: 'x' });

// 5冊ずつに分割する関数
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const sensors = useSensors(useSensor(MouseSensor));
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBooks = async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('book_order', { ascending: true });

      if (!error && data) {
        setBooks(data);
      }
    };
    fetchBooks();
  }, []);

  const addBook = async () => {
    if (!newUrl.trim()) return;

    const { error } = await supabase.from('books').insert([
      {
        url: newUrl,
        book_order: books.length,
      },
    ]);

    if (!error) {
      const { data } = await supabase
        .from('books')
        .select('*')
        .order('book_order', { ascending: true });
      setBooks(data || []);
      setNewUrl('');
      setSuccessMessage('追加成功！');
      setTimeout(() => setSuccessMessage(''), 2000);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = books.findIndex((b) => b.id === active.id);
    const newIndex = books.findIndex((b) => b.id === over.id);
    const newBooks = arrayMove(books, oldIndex, newIndex);

    setBooks(newBooks);

    await Promise.all(
      newBooks.map((book, index) =>
        supabase
          .from('books')
          .update({ book_order: index })
          .eq('id', book.id)
      )
    );
  };

  const handleShelfScreenshot = () => {
    if (shelfRef.current) {
      domtoimage.toJpeg(shelfRef.current, { quality: 0.95 })
        .then((dataUrl: string) => {
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = 'bookshelf.jpg';
          link.click();
        });
    }
  };

  const visibleBooks = showAll ? books : books.slice(0, 5);
  const remainingCount = books.length - 5;

  return (
    <>
      <div style={{ padding: '2rem', backgroundColor: '#000' }}>
        <h1>📚 シェルフマネジメント</h1>
        <div style={{ marginBottom: '2rem' }}>
          {successMessage && (
            <div style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: '0.5rem' }}>{successMessage}</div>
          )}
          <input
            type="text"
            placeholder={newUrl ? '' : 'オススメ本をAmazonURLで追加'}
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            style={{
              marginRight: '0.5rem',
              width: '300px',
              padding: '0.5rem',
              border: '2px solid #ccc',
              borderRadius: '6px',
              background: '#f9f9f9',
              fontSize: '1rem',
              outline: 'none',
              transition: 'border-color 0.2s',
              color: '#222',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#0070f3'}
            onBlur={e => e.currentTarget.style.borderColor = '#ccc'}
            className="amazon-url-input"
          />
          <button
            onClick={addBook}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.15)',
            }}
          >
            追加
          </button>
        </div>
        <div style={{ position: 'relative', width: '840px' }}>
          <div style={{ position: 'absolute', top: '-18px', right: '18px', display: 'flex', gap: '0.5rem', zIndex: 2 }}>
            <button
              onClick={handleShelfScreenshot}
              style={{
                border: '1px solid #b8874b',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                padding: '0.2rem 0.6rem',
                boxShadow: 'none',
                fontWeight: 'normal',
                background: '#fff',
                color: '#b8874b',
              }}
            >
              本棚を画像保存
            </button>
            {books.length > 5 && (
              <button
                onClick={() => setShowAll((prev) => !prev)}
                style={{
                  border: '1px solid #4CAF50',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.6rem',
                  boxShadow: 'none',
                  fontWeight: 'normal',
                  background: '#4CAF50',
                  color: '#fff',
                }}
              >
                {showAll ? '折りたたむ' : `全ての本（${books.length}冊）`}
              </button>
            )}
          </div>
          <h2 style={{
            position: 'absolute',
            top: '-18px',
            left: '24px',
            margin: 0,
            fontSize: '1.2rem',
            fontWeight: 'bold',
            color: '#7a5a2c',
            background: '#f5e1c6',
            padding: '0 0.5em',
            borderRadius: '8px 8px 0 0',
            zIndex: 2,
          }}>
            {showAll ? 'shin3のおすすめ本' : 'shin3の座右の5冊'}
          </h2>
          <div
            ref={shelfRef}
            style={{
              backgroundColor: '#f5e1c6', // 木の明るい色
              border: '12px solid #b8874b', // 木の枠
              borderRadius: '24px',
              boxShadow: '0 4px 24px rgba(80,60,30,0.10)',
              padding: '0',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '0.8rem',
              width: '840px',
              minWidth: '840px',
              maxWidth: '840px',
              position: 'relative',
              minHeight: '180px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={visibleBooks.map((book) => book.id)}
                strategy={horizontalListStrategy}
              >
                {visibleBooks.map((book) => (
                  <div key={book.id} style={{ width: '100%' }}>
                    <SortableBook book={book} />
                  </div>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .amazon-url-input::placeholder {
          color: #888;
          opacity: 1;
        }
      `}</style>
    </>
  );
}
