import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type View as RNView } from 'react-native';

export const NestableScrollContainer = ScrollView;

export function ScaleDecorator({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

type DragListProps<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (info: {
    item: T;
    drag: () => void;
    isActive: boolean;
    getIndex: () => number;
  }) => ReactNode;
  onDragEnd: (info: { data: T[] }) => void;
  style?: ScrollViewProps['style'];
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  showsVerticalScrollIndicator?: boolean;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
};

function WebPointerDragList<T>({
  data,
  keyExtractor,
  renderItem,
  onDragEnd,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator,
  keyboardShouldPersistTaps,
  asScrollView = false,
}: DragListProps<T> & { asScrollView?: boolean }) {
  const [items, setItems] = useState(data);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const rowRefs = useRef<Map<string, RNView | null>>(new Map());

  useEffect(() => {
    setItems(data);
  }, [data]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const resolveHoverIndex = useCallback(
    (clientY: number) => {
      const list = itemsRef.current;
      for (let i = 0; i < list.length; i++) {
        const node = rowRefs.current.get(keyExtractor(list[i])) as unknown as HTMLElement | null;
        const rect = node?.getBoundingClientRect?.();
        if (!rect) continue;
        const mid = rect.top + rect.height / 2;
        if (clientY < mid) return i;
      }
      return Math.max(0, list.length - 1);
    },
    [keyExtractor],
  );

  const startDrag = useCallback(
    (item: T) => {
      const id = keyExtractor(item);
      setDraggingId(id);

      const pointerY = (e: MouseEvent | TouchEvent) =>
        'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const onPointerMove = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        const hoverIndex = resolveHoverIndex(pointerY(e));
        setItems((prev) => {
          const from = prev.findIndex((row) => keyExtractor(row) === id);
          if (from < 0 || from === hoverIndex) return prev;
          const next = [...prev];
          const [removed] = next.splice(from, 1);
          next.splice(hoverIndex, 0, removed);
          return next;
        });
      };

      const onPointerEnd = () => {
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerEnd);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerEnd);
        setDraggingId(null);
        onDragEnd({ data: itemsRef.current });
      };

      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerEnd);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerEnd);
    },
    [keyExtractor, onDragEnd, resolveHoverIndex],
  );

  const rows = items.map((item, index) => {
    const id = keyExtractor(item);
    return (
      <View
        key={id}
        ref={(node) => {
          rowRefs.current.set(id, node);
        }}
      >
        {renderItem({
          item,
          drag: () => startDrag(item),
          isActive: draggingId === id,
          getIndex: () => items.findIndex((row) => keyExtractor(row) === id),
        })}
      </View>
    );
  });

  if (asScrollView) {
    return (
      <ScrollView
        style={style}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      >
        {rows}
      </ScrollView>
    );
  }

  return <View>{rows}</View>;
}

export function NestableDraggableFlatList<T>(props: DragListProps<T>) {
  return <WebPointerDragList {...props} asScrollView={false} />;
}

export function DraggableFlatList<T>(props: DragListProps<T>) {
  return <WebPointerDragList {...props} asScrollView={true} />;
}

/** Web uses pointer-based drag (no react-native-draggable-flatlist / findNodeHandle). */
export const agendaDragReorderSupported = true;
