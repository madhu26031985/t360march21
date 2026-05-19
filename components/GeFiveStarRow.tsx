import { View, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

export const GE_STAR_FILL = '#FFC940';
export const GE_STAR_STROKE = '#E5A800';
export const GE_STAR_EMPTY_STROKE = '#D5D4D4';

type GeFiveStarRowProps = {
  rating: number;
  size?: number;
  filledColor?: string;
  emptyStrokeColor?: string;
  strokeColor?: string;
};

export function GeFiveStarRow({
  rating,
  size = 16,
  filledColor = GE_STAR_FILL,
  emptyStrokeColor = GE_STAR_EMPTY_STROKE,
  strokeColor = GE_STAR_STROKE,
}: GeFiveStarRowProps) {
  const clamped = Math.min(5, Math.max(0, rating));
  return (
    <View style={styles.row}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - i));
        return (
          <View key={i} style={{ width: size, height: size }} collapsable={false}>
            <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }}>
              <Star size={size} color={emptyStrokeColor} fill="none" stroke={emptyStrokeColor} strokeWidth={1.25} />
            </View>
            {fill > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: size * fill,
                  height: size,
                  overflow: 'hidden',
                }}
              >
                <Star size={size} color={strokeColor} fill={filledColor} stroke={strokeColor} strokeWidth={1} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
