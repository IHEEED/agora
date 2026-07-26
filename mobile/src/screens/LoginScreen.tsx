import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigation.navigate('MainTabs');
  }

  async function handleSignUp() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigation.navigate('MainTabs');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fafafa' }}
    >
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 20 }}>Вход в Agora</Text>

      <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 8,
          padding: 10,
          marginBottom: 14,
          backgroundColor: '#fff',
        }}
      />

      <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Пароль</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 8,
          padding: 10,
          marginBottom: 14,
          backgroundColor: '#fff',
        }}
      />

      {error ? <Text style={{ color: '#dc2626', marginBottom: 12 }}>{error}</Text> : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={handleSignIn}
          disabled={loading}
          style={{
            flex: 1,
            backgroundColor: '#111',
            borderRadius: 999,
            paddingVertical: 12,
            alignItems: 'center',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Войти</Text>
        </Pressable>
        <Pressable
          onPress={handleSignUp}
          disabled={loading}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 999,
            paddingVertical: 12,
            alignItems: 'center',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Text style={{ fontWeight: '600' }}>Зарегистрироваться</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
